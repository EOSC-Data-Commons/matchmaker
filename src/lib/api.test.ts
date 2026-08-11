import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {sse, sseResponse} from "@/test/sse";
import type {SearchResults} from "@/types/commons";
import type {Message} from "@/types/chat";
import {
    fetchRepositoryStats,
    searchDatasets,
    sendChatMessage,
    streamChatEvents,
    RateLimitError,
    ServerError,
    type SSEEvent,
} from "./api";

/** An event-stream response delivered as the given raw chunks, to exercise SSE framing. */
const chunkedSseResponse = (chunks: string[]) => {
    const encoder = new TextEncoder();
    return new HttpResponse(
        new ReadableStream<Uint8Array>({
            start(controller) {
                for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
                controller.close();
            },
        }),
        {headers: {"Content-Type": "text/event-stream"}},
    );
};

const searchResult: SearchResults = {total_found: 1, hits: [makeDataset()]};

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

describe("streamChatEvents", () => {
    const collect = async (chunks: string[]) => {
        const events: SSEEvent[] = [];
        server.use(http.post("/api/search/chat", () => chunkedSseResponse(chunks)));
        await streamChatEvents({items: []}, e => events.push(e));
        return events.map(e => e.type);
    };

    it("reassembles an event split across chunk boundaries", async () => {
        const full = sse([{type: "RUN_STARTED"}, {type: "RUN_FINISHED"}]);
        const cut = full.indexOf("RUN_FINISHED") + 4; // mid-JSON
        expect(await collect([full.slice(0, cut), full.slice(cut)])).toEqual(["RUN_STARTED", "RUN_FINISHED"]);
    });

    it("handles several events in one chunk and ignores keep-alive comments", async () => {
        const body = ": keep-alive\n\n" + sse([{type: "a"}, {type: "b"}, {type: "RUN_FINISHED"}]);
        expect(await collect([body])).toEqual(["a", "b", "RUN_FINISHED"]);
    });

    it("skips malformed JSON and keeps processing", async () => {
        const body = "data: {broken json\n\n" + sse([{type: "RUN_FINISHED"}]);
        expect(await collect([body])).toEqual(["RUN_FINISHED"]);
    });

    it("stops the stream when the event handler throws", async () => {
        const seen: string[] = [];
        server.use(http.post("/api/search/chat", () =>
            sseResponse(sse([{type: "RUN_STARTED"}, {type: "RUN_ERROR"}, {type: "after"}]))));

        await expect(streamChatEvents({items: []}, (event) => {
            seen.push(event.type);
            if (event.type === "RUN_ERROR") throw new Error("agent failed");
        })).rejects.toThrow("agent failed");
        expect(seen).toEqual(["RUN_STARTED", "RUN_ERROR"]);
    });

    it("does not retry the request when the stream fails", async () => {
        let attempts = 0;
        server.use(http.post("/api/search/chat", () => {
            attempts += 1;
            return new HttpResponse(null, {status: 400});
        }));
        await expect(streamChatEvents({items: []}, () => {
        })).rejects.toThrow("Error sending the request: 400");
        expect(attempts).toBe(1);
    });
});

describe("searchDatasets", () => {
    it("queries the plain search endpoint and returns the hits", async () => {
        let url: URL | undefined;
        server.use(http.get("/api/search/search", ({request}) => {
            url = new URL(request.url);
            return HttpResponse.json(searchResult);
        }));

        await expect(searchDatasets("ocean data")).resolves.toEqual(searchResult);
        expect(url?.pathname).toBe("/api/search/search");
        expect(url?.searchParams.get("q")).toBe("ocean data");
        expect(url?.searchParams.get("resource")).toBe("datasets");
    });

    it("returns an empty result set rather than failing", async () => {
        const empty: SearchResults = {total_found: 0, hits: []};
        server.use(http.get("/api/search/search", () => HttpResponse.json(empty)));
        await expect(searchDatasets("nothing")).resolves.toEqual(empty);
    });

    it("throws RateLimitError on 429", async () => {
        server.use(http.get("/api/search/search", () => new HttpResponse(null, {status: 429})));
        await expect(searchDatasets("q")).rejects.toBeInstanceOf(RateLimitError);
    });

    it("throws ServerError on 5xx", async () => {
        server.use(http.get("/api/search/search", () => new HttpResponse(null, {status: 503})));
        await expect(searchDatasets("q")).rejects.toBeInstanceOf(ServerError);
    });

    it("throws a generic error for other non-OK statuses", async () => {
        server.use(http.get("/api/search/search", () => new HttpResponse(null, {status: 400})));
        await expect(searchDatasets("q")).rejects.toThrow("Error sending the request: 400");
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

    it("sends prior messages as plain text", async () => {
        let text = "";
        server.use(
            http.post("/api/search/chat", async ({request}) => {
                const body = await request.json() as { items: Array<{ content: Array<{ text: string }> }> };
                text = body.items[0].content[0].text;
                return sseResponse(chatRun);
            }),
        );
        const botMessage: Message = {sender: "bot", content: "Found this"};
        await sendChatMessage([botMessage], "m", undefined, () => {
        }, () => {
        });

        expect(text).toBe("Found this");
    });

    it("does not replay local error bubbles as assistant turns", async () => {
        let items: Array<{ role: string; content: Array<{ text: string }> }> = [];
        server.use(
            http.post("/api/search/chat", async ({request}) => {
                const body = await request.json() as { items: typeof items };
                items = body.items;
                return sseResponse(chatRun);
            }),
        );
        const messages: Message[] = [
            {sender: "user", content: "find data"},
            {sender: "bot", content: "Something went wrong while searching.", isError: true},
            {sender: "user", content: "try again"},
        ];
        await sendChatMessage(messages, "m", undefined, () => {
        }, () => {
        });

        expect(items.map(i => i.role)).toEqual(["user", "user"]);
        expect(JSON.stringify(items)).not.toContain("Something went wrong");
    });

    it("drops turns with no text, so no empty assistant message is sent", async () => {
        let items: Array<{ role: string }> = [];
        server.use(
            http.post("/api/search/chat", async ({request}) => {
                const body = await request.json() as { items: typeof items };
                items = body.items;
                return sseResponse(chatRun);
            }),
        );
        // A turn that only made a tool call has blocks but no text of its own.
        const messages: Message[] = [
            {sender: "user", content: "find data"},
            {
                sender: "bot",
                content: "   ",
                blocks: [{kind: "tool", toolCall: {id: "c1", name: "search_data", args: ""}}]
            },
            {sender: "user", content: "and now?"},
        ];
        await sendChatMessage(messages, "m", undefined, () => {
        }, () => {
        });

        expect(items.map(i => i.role)).toEqual(["user", "user"]);
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
        // A chat stream delivers everything through onEvent; reaching the end of
        // the stream is success, not a failure.
        server.use(http.post("/api/search/chat", () => sseResponse(chatRun)));
        const onError = vi.fn();
        await sendChatMessage([{sender: "user", content: "hi"}], "m", undefined, () => {
        }, onError);
        expect(onError).not.toHaveBeenCalled();
    });

    it("surfaces a terminal RUN_ERROR (backend timeout) through onError with its message", async () => {
        // Mirrors the backend RunErrorEvent(message=...) on a time-bounded LLM/tool
        // call: the stream ends with a RUN_ERROR and no results. It must not be
        // swallowed as NoResultsError — it should reach onError so the UI renders a
        // "timed out" bubble instead of hanging the spinner.
        const run = sse([
            {type: "RUN_STARTED", thread_id: "t-err"},
            {type: "RUN_ERROR", message: "LLM generation timed out"},
        ]);
        server.use(http.post("/api/search/chat", () => sseResponse(run)));
        const onError = vi.fn();
        await expect(sendChatMessage([{sender: "user", content: "hi"}], "m", undefined, () => {
        }, onError)).resolves.toBeUndefined();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].message).toBe("LLM generation timed out");
    });
});
