import {BackendDataset} from "@/types/commons.ts";

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
}

/**
 * A tool call made by the agent during an assistant turn, built incrementally
 * from the TOOL_CALL_START / TOOL_CALL_ARGS / TOOL_CALL_RESULT stream events.
 */
export interface ToolCall {
    id: string;
    name: string;
    // Raw (accumulated) argument JSON string, as sent by the backend.
    args: string;
    // Raw result payload, kept for tools whose output is not search results.
    output?: string;
    // Parsed hits when the result payload is a SearchResults object.
    hits?: BackendDataset[];
    totalFound?: number;
    done?: boolean;
}

/**
 * Bot messages are a sequence of blocks so tool calls and streamed text keep
 * the order the agent produced them in (text, tool, more text, ...).
 */
export type MessageBlock =
    | {kind: 'text'; text: string}
    | {kind: 'tool'; toolCall: ToolCall};

export interface Message {
    sender: 'user' | 'bot';
    // Plain text of the message: for bot messages this is the text blocks joined.
    content: string;
    blocks?: MessageBlock[];
    isError?: boolean;
    // True while the run producing this message is still streaming.
    isStreaming?: boolean;
}
