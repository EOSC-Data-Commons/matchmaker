// This file serve the purpose to hide the grpc calls in a wrapped typed function for frontend to call

import {DispatchResult, FileMeta, TaskId, ToolConfig, TypedValue, TypLaunchToolRequest} from "../types/dataplayerTypes";

export async function matchToolsByFiles(
    files: FileMeta[],
): Promise<Record<string, ToolConfig>> {
    const res = await fetch(`/api/coordinator/tool/match`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify({
            files: files,
        }),
    });

    if (!res.ok) {
        throw new Error(`Failed to match tools: ${res.status} ${res.statusText}`)
    }

    const tools: Record<string, ToolConfig> = await res.json();
    return tools;
}

export async function fetchFilesMetaByDatasetHandle(handle: string): Promise<FileMeta[]> {
    const res = await fetch(`/api/coordinator/files?handle=${encodeURIComponent(handle)}`);

    if (!res.ok) {
        throw new Error(`Failed to fetch file metadata from dataset handle: ${res.status} ${res.statusText}`)
    }

    const files: FileMeta[] = await res.json();
    return files;
}

/** Same-origin proxy URL for previewing a remote datafile (used by <img>/<iframe> src). */
export function filePreviewUrl(downloadUrl: string, mode: "text" | "binary" = "binary"): string {
    return `/api/coordinator/file-preview?mode=${mode}&url=${encodeURIComponent(downloadUrl)}`;
}

/** Fetch the first chunk of a text/CSV file as a string, flagging if it was truncated. */
export async function fetchTextPreview(downloadUrl: string): Promise<{ text: string; truncated: boolean }> {
    const res = await fetch(filePreviewUrl(downloadUrl, "text"));
    if (!res.ok) {
        throw new Error(`Failed to fetch preview: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const truncated = res.headers.get("X-Preview-Truncated") === "1";
    return {text, truncated};
}

export async function getToolById(toolId: string): Promise<ToolConfig> {
    const res = await fetch(`/api/coordinator/tool/get/${toolId}`);

    if (!res.ok) {
        throw new Error(`Failed to get tool: ${res.status} ${res.statusText}`)
    }

    const config: ToolConfig = await res.json();
    return config;
}

export async function searchToolsByText(text: string): Promise<Record<string, ToolConfig>> {
    const res = await fetch(`/api/coordinator/tool/search?q=${encodeURIComponent(text)}`);
    if (!res.ok) {
        throw new Error(`Failed to search tool by text: ${res.status} ${res.statusText}`)
    }

    const tools: Record<string, ToolConfig> = await res.json();
    return tools;
}

export async function startLaunchTask(
    toolId: string,
    dataset: string,
    slotToValueMapping: Record<string, TypedValue>,
    slotToFileMapping: Record<string, FileMeta>,
): Promise<TaskId> {
    const payload: TypLaunchToolRequest = {
        toolId,
        dataset,
        slotToValueMapping,
        slotToFileMapping,
    };
    const res = await fetch("/api/coordinator/start-task", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Failed to start task: ${res.status} ${res.statusText}`)
    }

    const taskId: TaskId = await res.json();
    return taskId;
}

export function taskStatusAsEventSource(taskId: TaskId): EventSource {
    const sse = new EventSource(`/api/coordinator/task-status/${taskId}`);
    return sse;
}

export async function getDispatchResultById(taskId: TaskId): Promise<DispatchResult> {
    const res = await fetch(`/api/coordinator/tasks-result/${taskId}`, {
        method: "GET",
    });

    if (!res.ok) {
        throw new Error(`Failed to dispatch: ${res.status} ${res.statusText}`)
    }

    const dispatchResult: DispatchResult = {url: await res.text()};
    return dispatchResult;
}
