import {useEffect, useRef, useState} from 'react';
import {DispatchResult, FileMeta, TaskStatus, ToolConfig, TypedValue} from '@/types/dataplayerTypes';
import {
    fetchFilesMetaByDatasetHandle,
    getDispatchResultById,
    getToolById,
    matchToolsByFiles,
    searchToolsByText,
    startLaunchTask,
    taskStatusAsEventSource
} from '@/lib/coordinatorApi';
import {useAuth} from './useAuth';

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
        }
    ) => {
        try {
            esRef.current?.close();

            const id = await startLaunchTask(userInfo, toolId, datasetUrl, datasetTitle, value_mapping, files);
            setTaskId(id);

            const es = taskStatusAsEventSource(id);
            esRef.current = es;

            es.onerror = (err) => {
                es.close();
                esRef.current = null;
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
                    callbacks.onSuccess();
                } else if (data.state === "EXCEPTION" || data.state === "DROPPED") {
                    es.close();
                    esRef.current = null;
                    callbacks.onError(new Error(`Task failed with state: ${data.state}`));
                }
            });

        } catch (err) {
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

export function useDataset(datasetHandle: string | null, enabled: boolean = true) {
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
            } catch (err) {
                console.error(err);
                setError("Failed to fetch files");
            } finally {
                setIsFilesLoading(false);
                console.log("Finished loading");
            }
        };

        load();
    }, [datasetHandle, enabled]);

    return {isFilesLoading, files, error, resetDataset};
}

export function useFilesToQueryTool(files: FileMeta[]) {
    const [queryToolResults, setQueryToolResults] = useState<Record<string, ToolConfig>>({});

    useEffect(() => {
        if (files.length < 1) {
            return;
        }

        async function load() {
            const tools = await matchToolsByFiles(files);
            setQueryToolResults(tools);
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
        if (debouncedSearch.trim().length < 2) {
            setSearchStatus('idle');
            setSearchError(null);
            return;
        }

        let cancelled = false;
        setSearchStatus('loading');
        setSearchError(null);

        async function load() {
            try {
                const tools = await searchToolsByText(debouncedSearch);
                if (!cancelled) {
                    setQueryToolResults(tools);
                    setSearchStatus('loaded');
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
                setStatus('error');
                setError(
                    err instanceof Error && err.message === 'timeout'
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
