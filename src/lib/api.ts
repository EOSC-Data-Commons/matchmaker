import {BackendDataset, BackendSearchResponse} from '../types/commons';
import {logError, fetchWithTimeout} from './utils.ts';
import {Message} from "@/types/chat.ts";

// --- API HELPERS ---
export const BACKEND_API_URL = '/api/search';

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
    error?: string; // For RUN_ERROR events
    timestamp?: string | number | null;
    raw_event?: unknown;
    delta?: string;
    thread_id?: string;
}

export interface SSEEventHandler {
    onSearchData?: (data: BackendSearchResponse) => void;
    onRerankedData?: (data: BackendSearchResponse) => void;
    onEvent?: (event: SSEEvent) => void;
    onError?: (error: Error) => void;
}

export const searchWithBackend = async (
    query: string,
    model: string = 'einfracz/qwen3-coder',
    handlers: SSEEventHandler,
    timeoutMs: number = 60000 // Default 1 minute timeout
): Promise<BackendSearchResponse> => {
    const requestBody: SearchRequest = {
        items: [{
            type: 'message',
            role: 'user',
            content: [{text: query}]
        }],
        model: model
    };

    try {
        const response = await fetchWithTimeout(
            `${BACKEND_API_URL}/chat`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'X-Accel-Buffering': 'no' // Disable buffering for Nginx proxies
                },
                body: JSON.stringify(requestBody),
                cache: 'no-store'
            },
            timeoutMs
        );

        if (response.status === 429) {
            throw new RateLimitError();
        }

        if (response.status >= 500) {
            throw new ServerError(response.status);
        }

        if (!response.ok) throw new Error(`Error sending the request: ${response.status}`);
        // if (!response.headers.get('content-type')?.includes('text/event-stream')) return response.json();

        const toolCallMap = new Map<string, string>();

        // Handle SSE stream based on tool_call_id
        return handleStream(response, (event) => {
            if (handlers?.onEvent) handlers.onEvent(event);

            // Handle RUN_ERROR - unrecoverable error during agent run
            if (event.type === 'RUN_ERROR') {
                const errorMessage = event.error || event.content || 'Agent run failed';
                const error = new Error(errorMessage);
                if (handlers?.onError) handlers.onError(error);
                throw error; // Terminate stream processing
            }

            if (event.type === 'TOOL_CALL_START' && event.tool_call_id && event.tool_call_name) {
                toolCallMap.set(event.tool_call_id, event.tool_call_name);
            }

            if (event.type === 'TOOL_CALL_RESULT' && event.content) {
                const searchResp = JSON.parse(event.content) as BackendSearchResponse;

                const toolName = event.tool_call_id ? (toolCallMap.get(event.tool_call_id) || event.tool_call_id) : undefined;

                if (toolName === 'rerank_results') {
                    if (handlers.onRerankedData) handlers.onRerankedData(searchResp);
                } else if (toolName === 'search_data') {
                    if (handlers.onSearchData) handlers.onSearchData(searchResp);
                }
                return searchResp;
            }

            // Legacy error handling (backward compatibility)
            if (event.type === 'error' && handlers?.onError) {
                handlers.onError(new Error(event.content || 'Unknown error'));
            }

            return null;
        });
    } catch (error) {
        logError(error, 'Search API');
        if (handlers.onError) handlers.onError(error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
};

/**
 * Generic SSE stream handler - parses data: field and calls onMessage with parsed JSON
 */
export const handleStream = async (
    response: Response,
    onMessage: (data: SSEEvent) => BackendSearchResponse | null
): Promise<BackendSearchResponse> => {
    if (!response.body) throw new Error('Response body is not readable');

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let latestResults: BackendSearchResponse | null = null;
    let runError: Error | null = null;

    try {
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            buffer += value;
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';
            for (const part of parts) {
                if (!part.trim()) continue;
                try {
                    const dataLine = part.split('\n').find(line => line.startsWith('data:'));
                    if (!dataLine) continue;
                    const event = JSON.parse(dataLine.slice(5).trim()) as SSEEvent;
                    try {
                        const result = onMessage(event);
                        if (result) latestResults = result;
                    } catch (e) {
                        // RUN_ERROR thrown from onMessage handler
                        if (e instanceof Error) {
                            runError = e;
                            break; // Stop processing further events
                        }
                        throw e;
                    }
                } catch (e) {
                    // Only log parse errors, not runtime errors
                    if (!runError) {
                        logError(e, 'Failed to parse SSE event');
                    }
                }
            }
            // Break outer loop if we encountered a RUN_ERROR
            if (runError) break;
        }

        // If we encountered a RUN_ERROR, throw it
        if (runError) throw runError;

        if (!latestResults) throw new Error('No search results received');
        return latestResults;
    } finally {
        reader.releaseLock();
    }
};

export const sendChatMessage = async (
    messages: Message[],
    model: string = 'einfracz/qwen3-coder',
    threadId: string | undefined,
    onEvent: (event: SSEEvent) => void,
    onError: (error: Error) => void
) => {
    const requestBody: Record<string, unknown> = {
        items: messages.map(msg => ({
            type: 'message',
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: [{
                text: (msg.hits && msg.hits.length > 0)
                    ? formatSearchResults(msg.content, msg.hits)
                    : msg.content
            }]
        })),
        model: model
    };

    if (threadId) {
        requestBody.thread_id = threadId;
    }

    try {
        const response = await fetch('/api/search/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await handleStream(response, (event) => {
            onEvent(event);
            return null;
        });

    } catch (error) {
        if (error instanceof Error) {
            onError(error);
        } else {
            onError(new Error('An unknown error occurred'));
        }
    }
};

function formatSearchResults(summary: string, hits: BackendDataset[]): string {
    if (!summary && (!hits || hits.length === 0)) {
        return 'No results found.';
    }

    let formatted = (summary || 'No summary available.') + '\n\n';

    if (!hits || hits.length === 0) {
        return formatted.trim();
    }

    hits.forEach((hit, index) => {
        if (!hit) return; // Skip null/undefined entries

        const source = hit._source;
        const title = source?.titles?.[0]?.title || hit.title || 'Untitled';
        const creator = source?.creators?.[0]?.creatorName || hit.creator || 'Unknown';
        const date = source?.dates?.find(d => d.dateType === 'Issued')?.date || hit.publication_date || 'N/A';
        const doi = source?.doi || hit._id || '';

        formatted += `${index + 1}. [${title}](${doi})\n`;
        formatted += `**Creator:** ${creator}\n`;
        formatted += `**Published:** ${date}\n`;

        const description = source?.descriptions?.[0]?.description || hit.description;
        if (description) {
            const truncated = description.length > 200
                ? description.substring(0, 200) + '...'
                : description;
            formatted += `**Description:** ${truncated}\n`;
        }

        formatted += '\n';
    });

    return formatted.trim();
}