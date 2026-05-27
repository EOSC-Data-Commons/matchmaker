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

    const launch = async (
        toolId: string,
        dataset: string,
        value_mapping: Record<string, TypedValue>,
        file_mapping: Record<string, FileMeta>,
        callbacks: {
            onState: (data: TaskStatus) => void;
            onSuccess: () => void;
            onError: (err: unknown) => void;
        }
    ) => {
        try {
            esRef.current?.close();

            console.warn("page", value_mapping);
            console.warn("page", file_mapping);
            const id = await startLaunchTask(toolId, dataset, value_mapping, file_mapping);
            setTaskId(id);

            const es = taskStatusAsEventSource(id);
            esRef.current = es;

            es.addEventListener("state", async (event) => {
                const data: TaskStatus = JSON.parse(event.data);
                callbacks.onState(data);

                if (data.state === "READY") {
                    es.close();
                    esRef.current = null;

                    const result = await getDispatchResultById(id);
                    setTaskResult(result);
                    callbacks.onSuccess();
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
    fileParametersMapping: Record<string, number>,
    valueParametersMapping: Record<string, TypedValue>,
): boolean => {
    if (!config) return false;

    const fileMapped = new Set(Object.keys(fileParametersMapping));
    const valueMapped = new Set(Object.keys(valueParametersMapping));

    return config.slots.every(param => fileMapped.has(param.name) || valueMapped.has(param.name));
};

export function useDataset(datasetHandle: string | null) {
    const [isFilesLoading, setIsFilesLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [files, setFiles] = useState<FileMeta[]>([]);

    const resetDataset = () => {
        setFiles([]);
        setError(null);
    };

    useEffect(() => {
        const load = async () => {
            if (!datasetHandle) return;
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
    }, [datasetHandle]);

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

    useEffect(() => {
        if (debouncedSearch.trim().length < 2) return;

        let cancelled = false;

        async function load() {
            const tools = await searchToolsByText(debouncedSearch);
            if (!cancelled) {
                setQueryToolResults(tools);
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

    return {debouncedSearch, queryToolResults};
}

export function useSelectedToolId(selectedToolId: string | null): { toolConfig: ToolConfig | null } {
    const [toolConfig, setToolConfig] = useState<ToolConfig | null>(null);

    useEffect(() => {
        async function load() {
            if (selectedToolId != null) {
                const config = await getToolById(selectedToolId);
                setToolConfig(config);
            }
        }

        load();
    }, [selectedToolId]);

    return {toolConfig};
}

