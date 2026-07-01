import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {sse, sseResponse} from "@/test/sse";
import type {BackendSearchResponse} from "@/types/commons";
import type {Message} from "@/types/chat";
import {
    fetchRepositoryStats,
    searchWithBackend,
    sendChatMessage,
    handleStream,
    RateLimitError,
    ServerError,
    NoResultsError,
    type SSEEvent,
} from "./api";

const streamResponse = (chunks: string[]): Response => {
    const encoder = new TextEncoder();
    return new Response(
        new ReadableStream<Uint8Array>({
            start(controller) {
                for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
                controller.close();
            },
        }),
    );
};

const searchResult: BackendSearchResponse = {hits: [makeDataset()], summary: "one hit"};

// logError writes to console.error on every failure path; keep test output clean.
beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {
    });
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe("fetchRepositoryStats", () => {
    it("returns parsed stats", async () => {
        // Shape mirrors the live backend response (GET /stats, api_version 0.7.13)
        const stats = {
            api_version: "0.7.13",
            generated_at: "2026-06-26T12:00:20Z",
            total_records: 446182,
            total_datasets: 446182,
            repositories: [{
                code: "DANS",
                name: "Data Archiving and Networked Services",
                record_count: 194651,
                datasets: 194651,
                endpoints_with_records: 5,
                synced_to_opensearch: 194651,
                latest_record_datestamp: "2026-06-16T00:10:33Z",
                top_subjects: [{subject: "Arts and Humanities", count: 185277}],
            }],
        };
        server.use(http.get("/api/search/stats", () => HttpResponse.json(stats)));
        await expect(fetchRepositoryStats()).resolves.toEqual(stats);
    });

    it("throws on HTTP errors", async () => {
        server.use(http.get("/api/search/stats", () => new HttpResponse(null, {status: 502})));
        await expect(fetchRepositoryStats()).rejects.toThrow("HTTP error! status: 502");
    });
});

describe("handleStream", () => {
    const collect = () => {
        const events: SSEEvent[] = [];
        const onMessage = (event: SSEEvent) => {
            events.push(event);
            return event.type === "TOOL_CALL_RESULT" ? searchResult : null;
        };
        return {events, onMessage};
    };

    it("parses an event split across chunk boundaries", async () => {
        const {events, onMessage} = collect();
        const full = sse([{type: "RUN_STARTED"}, {type: "TOOL_CALL_RESULT"}]);
        // Cut mid-JSON to prove buffering works
        const cut = full.indexOf("TOOL_CALL") + 4;
        const result = await handleStream(streamResponse([full.slice(0, cut), full.slice(cut)]), onMessage);
        expect(events.map(e => e.type)).toEqual(["RUN_STARTED", "TOOL_CALL_RESULT"]);
        expect(result).toBe(searchResult);
    });

    it("handles multiple events arriving in a single chunk", async () => {
        const {events, onMessage} = collect();
        await handleStream(
            streamResponse([sse([{type: "a"}, {type: "b"}, {type: "TOOL_CALL_RESULT"}])]),
            onMessage,
        );
        expect(events.map(e => e.type)).toEqual(["a", "b", "TOOL_CALL_RESULT"]);
    });

    it("skips malformed JSON events and keeps processing", async () => {
        const {events, onMessage} = collect();
        const body = "data: {broken json\n\n" + sse([{type: "TOOL_CALL_RESULT"}]);
        const result = await handleStream(streamResponse([body]), onMessage);
        expect(events.map(e => e.type)).toEqual(["TOOL_CALL_RESULT"]);
        expect(result).toBe(searchResult);
    });

    it("ignores parts without a data: line", async () => {
        const {events, onMessage} = collect();
        const body = ": keep-alive comment\n\nevent: ping\n\n" + sse([{type: "TOOL_CALL_RESULT"}]);
        await handleStream(streamResponse([body]), onMessage);
        expect(events.map(e => e.type)).toEqual(["TOOL_CALL_RESULT"]);
    });

    it("rethrows errors from the message handler and stops processing", async () => {
        const seen: string[] = [];
        const onMessage = (event: SSEEvent) => {
            seen.push(event.type);
            if (event.type === "RUN_ERROR") throw new Error("agent failed");
            return null;
        };
        const body = sse([{type: "RUN_STARTED"}, {type: "RUN_ERROR"}, {type: "after"}]);
        await expect(handleStream(streamResponse([body]), onMessage)).rejects.toThrow("agent failed");
        expect(seen).toEqual(["RUN_STARTED", "RUN_ERROR"]);
    });

    it("throws NoResultsError when the stream yields no results", async () => {
        const body = sse([{type: "TEXT_MESSAGE_CHUNK", delta: "hi"}, {type: "RUN_FINISHED"}]);
        await expect(handleStream(streamResponse([body]), () => null)).rejects.toBeInstanceOf(NoResultsError);
    });

    it("returns the latest result when several are produced", async () => {
        const first = {hits: [], summary: "first"};
        const second = {hits: [], summary: "second"};
        const onMessage = (event: SSEEvent) =>
            event.type === "one" ? first : event.type === "two" ? second : null;
        const result = await handleStream(streamResponse([sse([{type: "one"}, {type: "two"}])]), onMessage);
        expect(result).toBe(second);
    });
});

describe("searchWithBackend", () => {
    const rerankedResult: BackendSearchResponse = {hits: [makeDataset()], summary: "reranked"};

    const agentRun = sse([
        {type: "RUN_STARTED", thread_id: "t-1"},
        {type: "TOOL_CALL_START", tool_call_id: "c1", tool_call_name: "search_data"},
        {type: "TOOL_CALL_RESULT", tool_call_id: "c1", content: JSON.stringify(searchResult)},
        {type: "TOOL_CALL_START", tool_call_id: "c2", tool_call_name: "rerank_results"},
        {type: "TOOL_CALL_RESULT", tool_call_id: "c2", content: JSON.stringify(rerankedResult)},
        {type: "RUN_FINISHED"},
    ]);

    it("sends the query and default model, dispatches tool results to handlers", async () => {
        let requestBody: unknown;
        server.use(
            http.post("/api/search/chat", async ({request}) => {
                requestBody = await request.json();
                return sseResponse(agentRun);
            }),
        );
        const onSearchData = vi.fn();
        const onRerankedData = vi.fn();
        const onEvent = vi.fn();

        const result = await searchWithBackend("ocean data", undefined, {onSearchData, onRerankedData, onEvent});

        expect(requestBody).toEqual({
            items: [{type: "message", role: "user", content: [{text: "ocean data"}]}],
            model: "cesnet/agentic",
        });
        // The rerank result arrived last, so it wins
        expect(result).toEqual(rerankedResult);
        expect(onSearchData).toHaveBeenCalledExactlyOnceWith(searchResult);
        expect(onRerankedData).toHaveBeenCalledExactlyOnceWith(rerankedResult);
        expect(onEvent).toHaveBeenCalledTimes(6);
    });

    it("throws RateLimitError on 429 and reports it to onError", async () => {
        server.use(http.post("/api/search/chat", () => new HttpResponse(null, {status: 429})));
        const onError = vi.fn();
        await expect(searchWithBackend("q", "m", {onError})).rejects.toBeInstanceOf(RateLimitError);
        expect(onError.mock.calls[0][0]).toBeInstanceOf(RateLimitError);
    });

    it("throws ServerError on 5xx", async () => {
        server.use(http.post("/api/search/chat", () => new HttpResponse(null, {status: 503})));
        const onError = vi.fn();
        await expect(searchWithBackend("q", "m", {onError})).rejects.toBeInstanceOf(ServerError);
        expect(onError.mock.calls[0][0].message).toContain("503");
    });

    it("throws a generic error for other non-OK statuses", async () => {
        server.use(http.post("/api/search/chat", () => new HttpResponse(null, {status: 400})));
        await expect(searchWithBackend("q", "m", {})).rejects.toThrow("Error sending the request: 400");
    });

    it("surfaces RUN_ERROR events as an error and stops the stream", async () => {
        server.use(http.post("/api/search/chat", () =>
            sseResponse(sse([
                {type: "RUN_STARTED"},
                {type: "RUN_ERROR", error: "model overloaded"},
                {type: "RUN_FINISHED"},
            ])),
        ));
        const onError = vi.fn();
        const onEvent = vi.fn();
        await expect(searchWithBackend("q", "m", {onError, onEvent})).rejects.toThrow("model overloaded");
        expect(onError.mock.calls[0][0].message).toBe("model overloaded");
        // RUN_FINISHED must not be processed after the error
        expect(onEvent.mock.calls.map(c => c[0].type)).toEqual(["RUN_STARTED", "RUN_ERROR"]);
    });

    it("throws NoResultsError for a purely conversational answer", async () => {
        server.use(http.post("/api/search/chat", () =>
            sseResponse(sse([
                {type: "TEXT_MESSAGE_CHUNK", delta: "Hello!"},
                {type: "TEXT_MESSAGE_END"},
                {type: "RUN_FINISHED"},
            ])),
        ));
        await expect(searchWithBackend("hi", "m", {})).rejects.toBeInstanceOf(NoResultsError);
    });
});

describe("sendChatMessage", () => {
    const chatRun = sse([
        {type: "RUN_STARTED", thread_id: "t-9"},
        {type: "TEXT_MESSAGE_CHUNK", delta: "Hello"},
        {type: "TEXT_MESSAGE_END"},
        {type: "RUN_FINISHED"},
    ]);

    it("maps senders to roles, includes thread_id, and forwards events", async () => {
        let requestBody: {
            items: Array<{ role: string; content: Array<{ text: string }> }>;
            thread_id?: string
        } | undefined;
        server.use(
            http.post("/api/search/chat", async ({request}) => {
                requestBody = await request.json() as typeof requestBody;
                return sseResponse(chatRun);
            }),
        );
        const messages: Message[] = [
            {sender: "user", content: "find data"},
            {sender: "bot", content: "here you go"},
            {sender: "user", content: "thanks, more?"},
        ];
        const onEvent = vi.fn();
        await sendChatMessage(messages, "cesnet/agentic", "thread-1", onEvent, () => {
        });

        expect(requestBody?.items.map(i => i.role)).toEqual(["user", "assistant", "user"]);
        expect(requestBody?.thread_id).toBe("thread-1");
        expect(onEvent.mock.calls.map(c => c[0].type)).toEqual([
            "RUN_STARTED", "TEXT_MESSAGE_CHUNK", "TEXT_MESSAGE_END", "RUN_FINISHED",
        ]);
    });

    it("omits thread_id for new conversations", async () => {
        let requestBody: { thread_id?: string } | undefined;
        server.use(
            http.post("/api/search/chat", async ({request}) => {
                requestBody = await request.json() as typeof requestBody;
                return sseResponse(chatRun);
            }),
        );
        await sendChatMessage([{sender: "user", content: "hi"}], "m", undefined, () => {
        }, () => {
        });
        expect(requestBody).not.toHaveProperty("thread_id");
    });

    it("inlines prior search results into the message text", async () => {
        let text = "";
        server.use(
            http.post("/api/search/chat", async ({request}) => {
                const body = await request.json() as { items: Array<{ content: Array<{ text: string }> }> };
                text = body.items[0].content[0].text;
                return sseResponse(chatRun);
            }),
        );
        const withHits: Message = {sender: "bot", content: "Found this", hits: [makeDataset()]};
        await sendChatMessage([withHits], "m", undefined, () => {
        }, () => {
        });

        expect(text).toContain("Found this");
        expect(text).toContain("[Test Dataset Title]");
        expect(text).toContain("**Creator:** Doe, Jane");
    });

    it("reports HTTP failures through onError without throwing", async () => {
        server.use(http.post("/api/search/chat", () => new HttpResponse(null, {status: 500})));
        const onError = vi.fn();
        await expect(sendChatMessage([{sender: "user", content: "hi"}], "m", undefined, () => {
        }, onError))
            .resolves.toBeUndefined();
        expect(onError.mock.calls[0][0].message).toContain("500");
    });

    it("does not call onError after a successful stream", async () => {
        // Chat streams never produce a BackendSearchResponse, so handleStream's
        // NoResultsError fires on every completed chat; sendChatMessage must
        // swallow it rather than report success as a failure.
        server.use(http.post("/api/search/chat", () => sseResponse(chatRun)));
        const onError = vi.fn();
        await sendChatMessage([{sender: "user", content: "hi"}], "m", undefined, () => {
        }, onError);
        expect(onError).not.toHaveBeenCalled();
    });
});
