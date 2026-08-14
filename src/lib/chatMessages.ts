import type {SSEEvent} from "@/lib/api.ts";
import type {Message, MessageBlock, ToolCall} from "@/types/chat.ts";
import type {SearchResults} from "@/types/commons.ts";

/**
 * Builds the chat message model.
 *
 * The backend streams one assistant turn as an interleaving of text
 * (TEXT_MESSAGE_START / _CHUNK / _END) and tool calls (TOOL_CALL_START /
 * _ARGS / _RESULT / _END), possibly repeating for several agent iterations.
 * Everything produced between RUN_STARTED and RUN_FINISHED lands in a single
 * bot message whose `blocks` preserve that order. A conversation loaded from
 * the backend is rebuilt by replaying its stored items through the same reducer.
 */

/**
 * Recognises a `SearchResults` tool payload (`{total_found, hits: [...]}`) so search
 * results can be rendered as dataset cards; anything else is shown as raw output.
 */
const asSearchResults = (raw: string): SearchResults | null => {
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const hits = (parsed as Record<string, unknown>).hits;
        if (!Array.isArray(hits)) return null;
        if (hits.length > 0) {
            const first = hits[0];
            if (!first || typeof first !== 'object' || !('_source' in first)) return null;
        }
        return parsed as unknown as SearchResults;
    } catch {
        return null;
    }
};

const textOf = (blocks: MessageBlock[]): string =>
    blocks
        .flatMap(block => (block.kind === 'text' ? [block.text] : []))
        .join('\n\n')
        .trim();

/** Index of the bot message still open for streaming (always the last one), or -1. */
const openIndex = (messages: Message[]): number => {
    const last = messages.length - 1;
    const message = messages[last];
    return message?.sender === 'bot' && message.isStreaming ? last : -1;
};

/**
 * Applies `update` to the blocks of the message currently being streamed, opening
 * that message when the run has not produced anything yet.
 */
const withBlocks = (messages: Message[], update: (blocks: MessageBlock[]) => MessageBlock[]): Message[] => {
    const index = openIndex(messages);
    const open: Message = index === -1
        ? {sender: 'bot', content: '', blocks: [], isStreaming: true}
        : messages[index];
    const blocks = update(open.blocks ?? []);
    const rest = index === -1 ? messages : messages.slice(0, index);
    return [...rest, {...open, blocks, content: textOf(blocks)}];
};

const appendText = (blocks: MessageBlock[], delta: string): MessageBlock[] => {
    const last = blocks[blocks.length - 1];
    if (last?.kind === 'text') {
        return [...blocks.slice(0, -1), {kind: 'text', text: last.text + delta}];
    }
    return [...blocks, {kind: 'text', text: delta}];
};

const patchToolCall = (
    messages: Message[],
    toolCallId: string,
    patch: (toolCall: ToolCall) => ToolCall,
): Message[] => withBlocks(messages, blocks => blocks.map(block => (
    block.kind === 'tool' && block.toolCall.id === toolCallId
        ? {kind: 'tool', toolCall: patch(block.toolCall)}
        : block
)));

/** Closes the streaming message, dropping it if the run produced nothing at all. */
export const finalizeStream = (messages: Message[]): Message[] => {
    const index = openIndex(messages);
    if (index === -1) return messages;
    const open = messages[index];
    const rest = messages.slice(0, index);
    return open.blocks?.length ? [...rest, {...open, isStreaming: false}] : rest;
};

/** Reduces the TOOL_CALL_* events, which all create or patch the block of one tool call. */
const applyToolCallEvent = (messages: Message[], event: SSEEvent, toolCallId: string): Message[] => {
    switch (event.type) {
        case 'TOOL_CALL_START': {
            const toolCall: ToolCall = {id: toolCallId, name: event.tool_call_name || 'tool', args: ''};
            return withBlocks(messages, blocks => [...blocks, {kind: 'tool', toolCall}]);
        }

        case 'TOOL_CALL_ARGS': {
            const delta = event.delta ?? '';
            if (!delta) return messages;
            return patchToolCall(messages, toolCallId, tc => ({...tc, args: tc.args + delta}));
        }

        case 'TOOL_CALL_RESULT': {
            const content = event.content ?? '';
            const search = asSearchResults(content);
            return patchToolCall(messages, toolCallId, tc => (search
                ? {...tc, hits: search.hits, totalFound: search.total_found ?? search.hits.length, done: true}
                : {...tc, output: content, done: true}));
        }

        case 'TOOL_CALL_END':
            return patchToolCall(messages, toolCallId, tc => ({...tc, done: true}));

        default:
            return messages;
    }
};

/** Reduces one SSE event into the message list. Unknown event types are ignored. */
export const applyChatEvent = (messages: Message[], event: SSEEvent): Message[] => {
    // Every tool-call event addresses one tool call; without its id there is nothing to update.
    if (event.type.startsWith('TOOL_CALL_')) {
        return event.tool_call_id ? applyToolCallEvent(messages, event, event.tool_call_id) : messages;
    }

    switch (event.type) {
        case 'TEXT_MESSAGE_START':
            // Start a fresh text block so a new assistant message never merges
            // into text emitted before a tool call.
            return withBlocks(messages, blocks => [...blocks, {kind: 'text', text: ''}]);

        case 'TEXT_MESSAGE_CHUNK':
        case 'TEXT_MESSAGE_CONTENT': {
            const delta = event.delta ?? event.content ?? '';
            return delta ? withBlocks(messages, blocks => appendText(blocks, delta)) : messages;
        }

        // Both end the run: the message stops streaming, and an empty one is dropped.
        case 'RUN_FINISHED':
        case 'RUN_ERROR':
            return finalizeStream(messages);

        default:
            return messages;
    }
};

/**
 * Rebuilds messages from a stored conversation (`GET /conversation/{id}`) by
 * replaying its items through the same reducer used for the live stream.
 */
export const parseConversationItems = (items: unknown): Message[] => {
    if (!Array.isArray(items)) return [];
    let messages: Message[] = [];

    const itemText = (item: Record<string, unknown>): string => {
        if (typeof item.content === 'string') return item.content;
        if (Array.isArray(item.content)) {
            return item.content
                .map(part => (part && typeof part === 'object' ? String((part as Record<string, unknown>).text ?? '') : ''))
                .join('');
        }
        return '';
    };

    for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;

        if (item.type === 'message' && item.role === 'user') {
            messages = finalizeStream(messages);
            messages.push({sender: 'user', content: itemText(item)});
        } else if (item.type === 'message' && item.role === 'assistant') {
            const text = itemText(item);
            if (!text.trim()) continue;
            messages = applyChatEvent(messages, {type: 'TEXT_MESSAGE_START'});
            messages = applyChatEvent(messages, {type: 'TEXT_MESSAGE_CHUNK', delta: text});
        } else if (item.type === 'tool_call') {
            const id = String(item.id ?? '');
            if (!id) continue;
            messages = applyChatEvent(messages, {
                type: 'TOOL_CALL_START',
                tool_call_id: id,
                tool_call_name: String(item.name ?? 'tool'),
            });
            messages = applyChatEvent(messages, {
                type: 'TOOL_CALL_ARGS',
                tool_call_id: id,
                delta: JSON.stringify(item.arguments ?? {}),
            });
        } else if (item.type === 'tool_result') {
            const id = String(item.call_id ?? '');
            if (!id) continue;
            const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content ?? '');
            messages = applyChatEvent(messages, {type: 'TOOL_CALL_RESULT', tool_call_id: id, content});
        }
    }

    return finalizeStream(messages);
};
