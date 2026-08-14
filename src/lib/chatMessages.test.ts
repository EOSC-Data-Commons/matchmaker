import {describe, it, expect} from "vitest";
import {makeDataset} from "@/test/fixtures/datasets";
import type {SSEEvent} from "@/lib/api";
import type {Message, MessageBlock} from "@/types/chat";
import {applyChatEvent, finalizeStream, parseConversationItems} from "./chatMessages";
import {buildDatasetUrlMap} from "./datasetCitations";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";
const hit = makeDataset({dataset_url: DATASET_URL});
const searchPayload = JSON.stringify({total_found: 42, hits: [hit]});

const run = (events: SSEEvent[], messages: Message[] = []): Message[] =>
    events.reduce(applyChatEvent, messages);

const blocksOf = (messages: Message[]): MessageBlock[] => messages[messages.length - 1].blocks ?? [];

describe("applyChatEvent", () => {
    it("accumulates streamed text into a single open bot message", () => {
        const messages = run([
            {type: "TEXT_MESSAGE_START"},
            {type: "TEXT_MESSAGE_CHUNK", delta: "Found "},
            {type: "TEXT_MESSAGE_CHUNK", delta: "datasets."},
        ]);

        expect(messages).toHaveLength(1);
        expect(messages[0].sender).toBe("bot");
        expect(messages[0].isStreaming).toBe(true);
        expect(messages[0].content).toBe("Found datasets.");
        expect(blocksOf(messages)).toEqual([{kind: "text", text: "Found datasets."}]);
    });

    it("keeps tool calls and text in the order they arrived", () => {
        const messages = run([
            {type: "TEXT_MESSAGE_START"},
            {type: "TEXT_MESSAGE_CHUNK", delta: "Let me search."},
            {type: "TEXT_MESSAGE_END"},
            {type: "TOOL_CALL_START", tool_call_id: "c1", tool_call_name: "search_data"},
            {type: "TOOL_CALL_ARGS", tool_call_id: "c1", delta: '{"query":"ocean"}'},
            {type: "TOOL_CALL_RESULT", tool_call_id: "c1", content: searchPayload},
            {type: "TOOL_CALL_END", tool_call_id: "c1"},
            {type: "TEXT_MESSAGE_START"},
            {type: "TEXT_MESSAGE_CHUNK", delta: "Here it is."},
        ]);

        const blocks = blocksOf(messages);
        expect(blocks.map(b => b.kind)).toEqual(["text", "tool", "text"]);
        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe("Let me search.\n\nHere it is.");
    });

    it("parses a search result payload into hits and the total found", () => {
        const messages = run([
            {type: "TOOL_CALL_START", tool_call_id: "c1", tool_call_name: "search_data"},
            {type: "TOOL_CALL_RESULT", tool_call_id: "c1", content: searchPayload},
        ]);

        const block = blocksOf(messages)[0];
        expect(block.kind).toBe("tool");
        if (block.kind !== "tool") return;
        expect(block.toolCall.hits).toHaveLength(1);
        expect(block.toolCall.totalFound).toBe(42);
        expect(block.toolCall.output).toBeUndefined();
        expect(block.toolCall.done).toBe(true);
    });

    it("keeps a non-search result as raw output", () => {
        const messages = run([
            {type: "TOOL_CALL_START", tool_call_id: "c1", tool_call_name: "get_vault"},
            {type: "TOOL_CALL_RESULT", tool_call_id: "c1", content: '{"status":"ok"}'},
        ]);

        const block = blocksOf(messages)[0];
        if (block.kind !== "tool") throw new Error("expected a tool block");
        expect(block.toolCall.hits).toBeUndefined();
        expect(block.toolCall.output).toBe('{"status":"ok"}');
    });

    it("closes the message on RUN_FINISHED", () => {
        const messages = run([
            {type: "TEXT_MESSAGE_CHUNK", delta: "done"},
            {type: "RUN_FINISHED"},
        ]);
        expect(messages[0].isStreaming).toBe(false);
    });

    it("drops an empty streaming message when the run produced nothing", () => {
        expect(finalizeStream(run([{type: "RUN_STARTED"}], [{sender: "user", content: "hi"}]))).toEqual([
            {sender: "user", content: "hi"},
        ]);
    });

    it("starts a new message after the previous run was closed", () => {
        const first = run([{type: "TEXT_MESSAGE_CHUNK", delta: "one"}, {type: "RUN_FINISHED"}]);
        const second = run([{type: "TEXT_MESSAGE_CHUNK", delta: "two"}], first);
        expect(second).toHaveLength(2);
        expect(second[1].content).toBe("two");
    });
});

describe("parseConversationItems", () => {
    it("rebuilds messages and tool calls from stored conversation items", () => {
        const messages = parseConversationItems([
            {type: "message", role: "user", content: [{text: "ocean data"}]},
            {type: "tool_call", id: "c1", name: "search_data", arguments: {query: "ocean"}},
            {type: "tool_result", call_id: "c1", content: searchPayload},
            {type: "message", role: "assistant", content: [{text: "Found one."}]},
        ]);

        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({sender: "user", content: "ocean data"});
        expect(messages[1].isStreaming).toBe(false);
        expect(messages[1].content).toBe("Found one.");
        expect(blocksOf(messages).map(b => b.kind)).toEqual(["tool", "text"]);
        expect(buildDatasetUrlMap(messages).size).toBe(1);
    });

    it("returns nothing for a malformed payload", () => {
        expect(parseConversationItems(undefined)).toEqual([]);
        expect(parseConversationItems([null, 3, {type: "unknown"}])).toEqual([]);
    });
});
