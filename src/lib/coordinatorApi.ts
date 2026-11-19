// This file serve the purpose to hide the grpc calls in a wrapped typed function for frontend to call

import { UserInfo } from "@/hooks/useAuth";
import {DispatchResult, FileMeta, TaskId, ToolConfig, TypedValue, TypLaunchToolRequest} from "../types/dataplayerTypes";
import {ServerError} from "./api";

export async function matchToolsByFiles(
    files: FileMeta[],
): Promise<Record<string, ToolConfig>> {
    // NOTE: (jyu) if there are too many files, this will reach the payload size limit.
    // We don't yet have good matching mechanism thus we don't know what to pass to the tool-registry.
    // This function need rework after there are viable matching mechanism from T5.3 Packaging hub
    const MAX_FILES = 10;
    if (files.length > MAX_FILES) {
        console.warn(`matchToolsByFiles: ${files.length} files received, truncating to ${MAX_FILES}. Tool results may be incomplete.`);
    }
    const filesToMatch = files.slice(0, MAX_FILES);
    const res = await fetch(`/api/coordinator/tool/match`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify({
            files: filesToMatch,
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
        // A 5xx is the coordinator or the repository failing, which analytics
        // files as `server`. "Failed to fetch" wording is kept for the browser's
        // own network errors, so a bad status does not get counted as one.
        if (res.status >= 500) throw new ServerError(res.status);
        throw new Error(`File listing rejected for dataset handle: ${res.status} ${res.statusText}`);
    }

    const files: FileMeta[] = await res.json();
    return files;
}

/** A preview request the proxy will reject, carrying the status so the UI can
 *  tell "we cannot preview this" apart from "your signed link has expired". */
export class PreviewError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = "PreviewError";
    }
}

/** The parts of a FileMeta the preview proxy needs. */
export type PreviewTarget = Pick<FileMeta, "downloadUrl" | "previewSig">;

/**
 * Same-origin proxy URL for previewing a remote datafile (used by <img>/<iframe> src).
 * `previewSig` is the server's authorisation for this exact URL; without it the
 * proxy refuses to fetch anything.
 */
export function filePreviewUrl(file: PreviewTarget, mode: "text" | "binary" = "binary"): string {
    const params = new URLSearchParams({
        mode,
        url: file.downloadUrl ?? "",
        sig: file.previewSig ?? "",
    });
    return `/api/coordinator/file-preview?${params}`;
}

/** Fetch the first chunk of a text/CSV file as a string, flagging if it was truncated. */
export async function fetchTextPreview(file: PreviewTarget): Promise<{ text: string; truncated: boolean }> {
    const res = await fetch(filePreviewUrl(file, "text"));
    if (!res.ok) {
        throw new PreviewError(res.status, `Failed to fetch preview: ${res.status} ${res.statusText}`);
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

/**
 * Turn a coordinator/tool-registry failure into a message we can show a user.
 * The server relays the raw gRPC error in the JSON body (e.g. "1 CANCELLED: Call
 * cancelled" when the upstream tool-registry service crashes mid-request), which
 * is meaningless to an end user — so map the known cases to plain language.
 */
async function coordinatorErrorMessage(res: Response, fallback: string): Promise<string> {
    let detail = "";
    try {
        const body = await res.json();
        detail = typeof body?.error === "string" ? body.error : "";
    } catch {
        // non-JSON body (e.g. proxy "Proxy error" text); ignore and use fallback
    }

    const lower = detail.toLowerCase();
    if (res.status === 502 || res.status === 503 || res.status === 504 ||
        lower.includes("cancelled") || lower.includes("unavailable")) {
        return "The tool registry service is currently unavailable. Please try again in a moment.";
    }
    // Catch-all for raw gRPC/backend internals — "5 NOT_FOUND: not find tool,
    // search_tools_by_text, error decoding response body for url (...)" and the
    // like. These leak implementation details and are meaningless to users, so
    // never surface them verbatim regardless of the exact error shape.
    if (res.status >= 500 ||
        lower.includes("not_found") || lower.includes("not found") ||
        lower.includes("error decoding") ||
        /\b\d+\s+[a-z_]+:/i.test(detail)) {
        return "No tools matched — try a different search term.";
    }
    if (detail) {
        return `${fallback}: ${detail}`;
    }
    return `${fallback} (${res.status} ${res.statusText})`;
}

export async function searchToolsByText(text: string): Promise<Record<string, ToolConfig>> {
    const res = await fetch(`/api/coordinator/tool/search?q=${encodeURIComponent(text)}`);
    if (!res.ok) {
        throw new Error(await coordinatorErrorMessage(res, "Failed to search tools"));
    }

    const tools: Record<string, ToolConfig> = await res.json();
    return tools;
}

export async function startLaunchTask(
    userInfo: UserInfo,
    toolId: string,
    datasetUrl: string,
    datasetTitle: string,
    slotMapping: Record<string, TypedValue>,
    files: Record<string, FileMeta>,
): Promise<TaskId> {
    const payload: TypLaunchToolRequest = {
        userInfo,
        toolId,
        datasetUrl,
        datasetTitle,
        slotMapping,
        files,
    };
    const res = await fetch("/api/coordinator/start-task", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        // The coordinator returns the rejected RO-Crate so the user can download
        // it and inspect what the dispatcher received.
        let rocrate: string | null = null;
        try {
            const body = await res.json();
            if (typeof body?.rocrate === "string") rocrate = body.rocrate;
        } catch {
            // non-JSON error body; fall back to a plain message
        }
        throw new LaunchTaskError(
            `Failed to start task: ${res.status} ${res.statusText}`,
            rocrate ?? undefined,
        );
    }

    const taskId: TaskId = await res.json();
    return taskId;
}

// Error thrown when the coordinator fails to start a task, optionally carrying
// the RO-Crate that was rejected by the dispatcher for download.
export class LaunchTaskError extends Error {
    constructor(message: string, public readonly rocrate?: string) {
        super(message);
        this.name = "LaunchTaskError";
    }
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
