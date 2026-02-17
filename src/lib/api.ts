import {BackendSearchResponse} from '../types/commons';
import {logError, fetchWithTimeout} from './utils.ts';

// --- API HELPERS ---
export const BACKEND_API_URL = '/api/search';

export interface SearchRequest {
    messages: Array<{
        role: 'user';
        content: string;
    }>;
    model: string;
}

// NOTE: you could probably reuse types defined in AG-UI TS SDK https://docs.ag-ui.com/sdk/js/core/overview
export interface SSEEvent {
    type: string;
    message_id?: string;
    tool_call_id?: string;
    content?: string;
    role?: string;
    error?: string; // For RUN_ERROR events
    timestamp?: string | null;
    raw_event?: unknown;
}

export interface SSEEventHandler {
    onSearchData?: (data: BackendSearchResponse) => void;
    onRerankedData?: (data: BackendSearchResponse) => void;
    onEvent?: (event: SSEEvent) => void;
    onError?: (error: Error) => void;
}

export const searchWithBackend = async (
    query: string,
    model: string = 'einfracz/gpt-oss-120b',
    handlers: SSEEventHandler,
    timeoutMs: number = 60000 // Default 1 minute timeout
): Promise<BackendSearchResponse> => {
    const requestBody: SearchRequest = {
        messages: [{ role: 'user', content: query }],
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

        if (!response.ok) throw new Error(`Error sending the request: ${response.status}`);
        // if (!response.headers.get('content-type')?.includes('text/event-stream')) return response.json();

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

            // Handle TOOL_CALL_RESULT events
            if (event.type === 'TOOL_CALL_RESULT' && event.content) {
                const searchResp = JSON.parse(event.content) as BackendSearchResponse;
                if (event.tool_call_id === 'rerank_results') {
                    if (handlers.onRerankedData) handlers.onRerankedData(searchResp);
                } else if (event.tool_call_id === 'search_data') {
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
const handleStream = async (
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
            const { done, value } = await reader.read();
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


