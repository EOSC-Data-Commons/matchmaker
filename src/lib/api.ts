import {EventStreamContentType, fetchEventSource} from '@microsoft/fetch-event-source';
import {SearchResults, RepositoryStatsResponse} from '../types/commons';
import {logError, fetchWithTimeout} from './utils.ts';
import {Message} from "@/types/chat.ts";

// --- API HELPERS ---
export const BACKEND_API_URL = '/api/search';

/**
 * Fetches repository/dataset statistics for the landing page charts.
 */
export const fetchRepositoryStats = async (
    timeoutMs: number = 15000
): Promise<RepositoryStatsResponse> => {
    try {
        const response = await fetchWithTimeout(
            `${BACKEND_API_URL}/stats`,
            {
                method: 'GET',
                headers: {'Accept': 'application/json'}
            },
            timeoutMs
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json() as RepositoryStatsResponse;
    } catch (error) {
        logError(error, 'fetchRepositoryStats');
        throw error;
    }
};

export class RateLimitError extends Error {
    constructor(message?: string) {
        super(message || "We are receiving too many requests. Please try again in a few minutes.");
        this.name = "RateLimitError";
    }
}

export class ServerError extends Error {
    constructor(statusCode: number) {
        super(`Our services are currently experiencing technical difficulties (Error ${statusCode}). Please try again later.`);
        this.name = "ServerError";
    }
}

/**
 * Thrown when the stream completes without any dataset results (e.g. the agent
 * answered conversationally via TEXT_MESSAGE_CHUNK events instead of calling a
 * search tool). This is not a failure — it should surface as a friendly
 * "no results" view, not a red error.
 */
export class NoResultsError extends Error {
    constructor(message?: string) {
        super(message || "No search results received");
        this.name = "NoResultsError";
    }
}

export interface SearchRequest {
    items: Array<{
        type: string;
        role: 'user' | 'assistant';
        content: Array<{ text: string }>;
    }>;
    model: string;
}

// NOTE: you could probably reuse types defined in AG-UI TS SDK https://docs.ag-ui.com/sdk/js/core/overview
export interface SSEEvent {
    type: string;
    message_id?: string;
    tool_call_id?: string;
    tool_call_name?: string;
    content?: string;
    role?: string;
    error?: string; // legacy error field (kept for backward compatibility)
    message?: string; // RUN_ERROR text emitted by the backend (AG-UI RunErrorEvent)
    timestamp?: string | number | null;
    raw_event?: unknown;
    delta?: string;
    thread_id?: string;
}

export interface SSEEventHandler {
    onSearchData?: (data: SearchResults) => void;
    // Chunks of the assistant's summary of the results, as they stream in.
    onSummaryDelta?: (delta: string) => void;
    onEvent?: (event: SSEEvent) => void;
    onError?: (error: Error) => void;
}

/** Text carried by a terminal RUN_ERROR event (AG-UI RunErrorEvent). */
const runErrorMessage = (event: SSEEvent): string =>
    event.message || event.error || event.content || 'The search failed. Please try again.';

/**
 * POSTs to the streaming chat endpoint and forwards every SSE event to `onEvent`.
 * Resolves once the server closes the stream, and rejects on a RUN_ERROR — the
 * backend's terminal error (a stalled LLM or tool call, a provider failure),
 * which is delivered to `onEvent` first so callers can still render what arrived.
 *
 * SSE framing, buffering across chunk boundaries and keep-alive comments are
 * handled by @microsoft/fetch-event-source. Two of its defaults are overridden:
 * it never retries (one request is one agent run — a retry would restart the
 * whole run) and it keeps streaming while the tab is hidden.
 *
 * `onEvent` may throw to stop the stream early (used for terminal RUN_ERROR);
 * the error propagates out of this call.
 */
export const streamChatEvents = async (
    requestBody: object,
    onEvent: (event: SSEEvent) => void
): Promise<void> => {
    await fetchEventSource(`${BACKEND_API_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no' // Disable buffering for Nginx proxies
        },
        body: JSON.stringify(requestBody),
        cache: 'no-store',
        openWhenHidden: true,
        onopen: async (response) => {
            if (response.status === 429) throw new RateLimitError();
            if (response.status >= 500) throw new ServerError(response.status);
            if (!response.ok) throw new Error(`Error sending the request: ${response.status}`);
            if (!response.headers.get('content-type')?.startsWith(EventStreamContentType)) {
                throw new Error('The server did not return an event stream');
            }
        },
        onmessage: (message) => {
            if (!message.data) return;
            let event: SSEEvent;
            try {
                event = JSON.parse(message.data) as SSEEvent;
            } catch (e) {
                logError(e, 'Failed to parse SSE event');
                return;
            }
            onEvent(event);
            if (event.type === 'RUN_ERROR') throw new Error(runErrorMessage(event));
        },
        onerror: (error) => {
            // Rethrowing rejects the promise; returning would schedule a retry.
            throw error;
        },
    });
};

export const searchWithBackend = async (
    query: string,
    model: string = 'cesnet/agentic',
    handlers: SSEEventHandler
): Promise<SearchResults> => {
    const requestBody: SearchRequest = {
        items: [{
            type: 'message',
            role: 'user',
            content: [{text: query}]
        }],
        model: model
    };

    const toolCallMap = new Map<string, string>();
    let latestResults: SearchResults | null = null;

    try {
        await streamChatEvents(requestBody, (event) => {
            if (handlers.onEvent) handlers.onEvent(event);

            switch (event.type) {
                case 'TOOL_CALL_START':
                    if (event.tool_call_id && event.tool_call_name) {
                        toolCallMap.set(event.tool_call_id, event.tool_call_name);
                    }
                    return;

                case 'TOOL_CALL_RESULT': {
                    if (!event.content) return;
                    let searchResp: SearchResults;
                    try {
                        searchResp = JSON.parse(event.content) as SearchResults;
                    } catch (e) {
                        logError(e, 'Failed to parse tool result');
                        return;
                    }

                    const toolName = event.tool_call_id
                        ? toolCallMap.get(event.tool_call_id) || event.tool_call_id
                        : undefined;
                    // Only the search tool feeds the results list; other tools may
                    // run in the same turn and are not results.
                    if (toolName !== 'search_data') return;
                    if (handlers.onSearchData) handlers.onSearchData(searchResp);
                    latestResults = searchResp;
                    return;
                }

                case 'TEXT_MESSAGE_CHUNK':
                case 'TEXT_MESSAGE_CONTENT':
                    if (event.delta && handlers.onSummaryDelta) handlers.onSummaryDelta(event.delta);
                    return;

                // Legacy error event (backward compatibility)
                case 'error':
                    if (handlers.onError) handlers.onError(new Error(event.content || 'Unknown error'));
            }
        });

        if (!latestResults) throw new NoResultsError();
        return latestResults;
    } catch (error) {
        logError(error, 'Search API');
        if (handlers.onError) handlers.onError(error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
};

export const sendChatMessage = async (
    messages: Message[],
    model: string = 'cesnet/agentic',
    threadId: string | undefined,
    onEvent: (event: SSEEvent) => void,
    onError: (error: Error) => void
) => {
    const requestBody: Record<string, unknown> = {
        items: messages.map(msg => ({
            type: 'message',
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: [{text: msg.content}]
        })),
        model: model
    };

    if (threadId) {
        requestBody.thread_id = threadId;
    }

    try {
        await streamChatEvents(requestBody, onEvent);
    } catch (error) {
        onError(error instanceof Error ? error : new Error('An unknown error occurred'));
    }
};
