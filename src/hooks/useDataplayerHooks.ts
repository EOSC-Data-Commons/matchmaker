import {useEffect, useRef, useState} from 'react';
import {DispatchResult, FileMeta, TaskStatus, ToolConfig, TypedValue} from '@/types/dataplayerTypes';
import {
    fetchFilesMetaByDatasetHandle,
    getDispatchResultById,
    getToolById,
    matchToolsByFiles,
    matchToolsByDescription,
    searchToolsByText,
    startLaunchTask,
    taskStatusAsEventSource
} from '@/lib/coordinatorApi';
import {useAuth} from './useAuth';
import {errorKind, trackEvent} from '@/lib/analytics';

export function buildSlotToFileMapping(
    mapping: Record<string, number>,
    files: FileMeta[]
): Record<string, FileMeta> {
    const result: Record<string, FileMeta> = {};
    for (const [slot, idxStr] of Object.entries(mapping)) {
        const idx = Number(idxStr);
        result[slot] = files[idx];
    }
    return result;
}

export function useTaskLauncher() {
    const [taskId, setTaskId] = useState<string | null>(null);
    const [taskResult, setTaskResult] = useState<DispatchResult | null>(null);
    const esRef = useRef<EventSource | null>(null);

    const resetTask = () => {
        setTaskId(null);
        setTaskResult(null);
    };

    useEffect(() => {
        return () => {
            esRef.current?.close(); // cleanup on unmount
        };
    }, []);
    const {user: userInfo} = useAuth();

    const launch = async (
        toolId: string,
        datasetUrl: string,
        datasetTitle: string,
        value_mapping: Record<string, TypedValue>,
        files: Record<string, FileMeta>,
        callbacks: {
            onState: (data: TaskStatus) => void;
            onSuccess: () => void;
            onError: (err: unknown) => void;
        },
        // Analytics only: the registry name reads better in a report than a uuid.
        toolName: string = toolId,
    ) => {
        // The launch is the point of the whole page, so its outcome is measured
        // end to end from here, where the task states arrive first-hand.
        const submittedAt = Date.now();
        trackEvent('Data Player', 'launch_submitted', toolName, Object.keys(files).length);
        const reportFailure = (reason: string) =>
            trackEvent('Data Player', 'launch_failed', `${toolName}:${reason}`, Date.now() - submittedAt);

        try {
            esRef.current?.close();

            const id = await startLaunchTask(userInfo, toolId, datasetUrl, datasetTitle, value_mapping, files);
            setTaskId(id);

            const es = taskStatusAsEventSource(id);
            esRef.current = es;

            es.onerror = (err) => {
                es.close();
                esRef.current = null;
                reportFailure('stream_error');
                callbacks.onError(err);
            };

            es.addEventListener("state", async (event) => {
                const data: TaskStatus = JSON.parse(event.data);
                callbacks.onState(data);

                if (data.state === "READY") {
                    es.close();
                    esRef.current = null;

                    const result = await getDispatchResultById(id);
                    setTaskResult(result);
                    trackEvent('Data Player', 'launch_succeeded', toolName, Date.now() - submittedAt);
                    callbacks.onSuccess();
                } else if (data.state === "EXCEPTION" || data.state === "DROPPED") {
                    es.close();
                    esRef.current = null;
                    reportFailure(data.state);
                    callbacks.onError(new Error(`Task failed with state: ${data.state}`));
                }
            });

        } catch (err) {
            reportFailure(errorKind(err));
            callbacks.onError(err);
        }
    };
    return {taskId, taskResult, launch, resetTask};
}

export const areAllParametersMapped = (
    config: ToolConfig | null,
    valueParametersMapping: Record<string, TypedValue>,
): boolean => {
    if (!config) return false;

    const valueMapped = new Set(Object.keys(valueParametersMapping));

    return config.slots.filter((p) => !p.isOptional).every(param => valueMapped.has(param.name));
};

export function useDataset(datasetHandle: string | null, enabled: boolean = true, repo: string = 'unknown') {
    const [isFilesLoading, setIsFilesLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [files, setFiles] = useState<FileMeta[]>([]);

    const resetDataset = () => {
        setFiles([]);
        setError(null);
    };

    useEffect(() => {
        // Wait until enabled (e.g. the user is authenticated) before hitting the
        // coordinator API — otherwise the call fails and surfaces a misleading
        // "failed to fetch files" error while the login prompt is shown.
        if (!enabled) return;

        const load = async () => {
            if (!datasetHandle) {
                setIsFilesLoading(false);
                setError("No dataset ID provided");
                return;
            }
            console.log("Start loading");
            try {
                setIsFilesLoading(true);
                const fetchedFiles = await fetchFilesMetaByDatasetHandle(datasetHandle);
                setFiles(fetchedFiles);
                // Zero included: an empty listing is a finding about the repository.
                trackEvent('Data Player', 'files_loaded', repo, fetchedFiles.length);
            } catch (err) {
                console.error(err);
                trackEvent('Data Player', 'files_failed', `${repo}:${errorKind(err)}`);
                setError("Failed to fetch files");
            } finally {
                setIsFilesLoading(false);
                console.log("Finished loading");
            }
        };

        load();
    }, [datasetHandle, enabled, repo]);

    return {isFilesLoading, files, error, resetDataset};
}

export function useDescriptionToQueryTool(description: string) {
    const [queryToolResults, setQueryToolResults] =
        useState<Record<string, ToolConfig>>({});

    const [isLoading, setIsLoading] = useState(!!description);

    useEffect(() => {
        if (!description) {
            setIsLoading(false);
            setQueryToolResults({});
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        async function load() {
            try {
                const tools = await matchToolsByDescription(description);

                if (!cancelled) {
                    setQueryToolResults(tools);
                }
            } catch (error) {
                console.error("Failed to match tools:", error);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [description]);

    return { queryToolResults, isLoading };
}

/**
 * @deprecated Using useDescriptionToQueryTool instead.
 * consider removing for release 1.1
 */
export function useFilesToQueryTool(files: FileMeta[]) {
    const [queryToolResults, setQueryToolResults] = useState<Record<string, ToolConfig>>({});

    useEffect(() => {
        if (files.length < 1) {
            return;
        }

        async function load() {
            const tools = await matchToolsByFiles(files);
            setQueryToolResults(tools);
            trackEvent('Data Player', 'tools_listed', 'file_match', Object.keys(tools).length);
        }

        load();
    }, [files]);

    return {queryToolResults};
}

export function useSearchTextToQueryTool(toolSearchText: string) {
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [queryToolResults, setQueryToolResults] = useState<Record<string, ToolConfig>>({});
    const [searchStatus, setSearchStatus] = useState<ToolConfigStatus>('idle');
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (debouncedSearch.trim().length < 2) {
                if (!cancelled) {
                    setSearchStatus('idle');
                    setSearchError(null);
                }
                return;
            }

            if (!cancelled) {
                setSearchStatus('loading');
                setSearchError(null);
            }

            try {
                const tools = await searchToolsByText(debouncedSearch);
                if (!cancelled) {
                    setQueryToolResults(tools);
                    setSearchStatus('loaded');
                    // The count only: the search text itself is never reported.
                    trackEvent('Data Player', 'tools_listed', 'text_search', Object.keys(tools).length);
                }
            } catch (err) {
                if (!cancelled) {
                    setQueryToolResults({});
                    setSearchError(err instanceof Error ? err.message : String(err));
                    setSearchStatus('error');
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [debouncedSearch]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearch(toolSearchText);
        }, 500);

        return () => clearTimeout(timeout);
    }, [toolSearchText]);

    return {debouncedSearch, queryToolResults, searchStatus, searchError};
}

export type ToolConfigStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** how long to wait for the coordinator's tool config before giving up so the
 * map-files step never dead-ends on "Loading tool config…". */
const TOOL_CONFIG_TIMEOUT_MS = 15_000;

export function useSelectedToolId(selectedToolId: string | null): {
    toolConfig: ToolConfig | null;
    status: ToolConfigStatus;
    error: string | null;
    retry: () => void;
} {
    const [toolConfig, setToolConfig] = useState<ToolConfig | null>(null);
    const [status, setStatus] = useState<ToolConfigStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (selectedToolId == null) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;

        const load = async () => {
            setStatus('loading');
            setError(null);
            setToolConfig(null);

            // Race the request against a timeout so a hung/never-returning
            // coordinator call surfaces an error (with a retry path) instead of
            // spinning on "Loading tool config…" forever.
            const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('timeout')), TOOL_CONFIG_TIMEOUT_MS);
            });

            try {
                const config = await Promise.race([getToolById(selectedToolId), timeout]);
                if (cancelled) return;
                setToolConfig(config as ToolConfig);
                setStatus('loaded');
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to load tool config', err);
                const timedOut = err instanceof Error && err.message === 'timeout';
                trackEvent('Data Player', 'tool_config_failed', timedOut ? 'timeout' : 'error');
                setStatus('error');
                setError(
                    timedOut
                        ? 'Loading the tool configuration timed out. The service may be unavailable.'
                        : 'Failed to load the tool configuration.'
                );
            } finally {
                clearTimeout(timer);
            }
        };

        load();

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [selectedToolId, reloadKey]);

    const retry = () => setReloadKey((k) => k + 1);

    return {toolConfig, status, error, retry};
}
