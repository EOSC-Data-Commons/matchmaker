import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {sse, sseResponse} from "@/test/sse";
import type {Message} from "@/types/chat";
import {
    discardRun,
    findRun,
    getChatRuns,
    markRunSeen,
    startRun,
    stopRun,
    subscribeToChatRuns,
} from "./chatRuns";

const question: Message[] = [{sender: "user", content: "ocean data"}];

const answer = sse([
    {type: "RUN_STARTED", thread_id: "t-1"},
    {type: "TEXT_MESSAGE_START", message_id: "m1"},
    {type: "TEXT_MESSAGE_CHUNK", delta: "Here you go."},
    {type: "TEXT_MESSAGE_END", message_id: "m1"},
    {type: "RUN_FINISHED", thread_id: "t-1"},
]);

/** A response that sends `events` and then stays open, like an answer still being written. */
const openResponse = (events: object[]) => () => new HttpResponse(
    new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(sse(events)));
        },
    }),
    {headers: {"Content-Type": "text/event-stream"}},
);

const lastText = (id: string) => {
    const messages = findRun(getChatRuns(), id)?.messages ?? [];
    return messages[messages.length - 1]?.content;
};

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {
    });
});
afterEach(() => {
    getChatRuns().forEach(run => discardRun(run.key));
    vi.restoreAllMocks();
});

describe("chat runs", () => {
    it("streams a run into its own entry and records the thread id it is given", async () => {
        server.use(http.post("/api/search/chat", () => sseResponse(answer)));
        const listener = vi.fn();
        const onEvent = vi.fn();
        const unsubscribe = subscribeToChatRuns(listener);

        await startRun({key: "new-1", title: "ocean data", messages: question, model: "m", onEvent});
        unsubscribe();

        const run = findRun(getChatRuns(), "t-1");
        expect(run).toBe(findRun(getChatRuns(), "new-1"));
        expect(run?.threadId).toBe("t-1");
        expect(run?.status).toBe("finished");
        // Nobody marked it seen while it ran.
        expect(run?.seen).toBe(false);
        expect(run?.messages.map(m => m.sender)).toEqual(["user", "bot"]);
        expect(lastText("t-1")).toBe("Here you go.");
        expect(run?.messages[1].isStreaming).toBe(false);
        expect(listener).toHaveBeenCalled();
        // Handed every applied event with the thread after it; RUN_STARTED only names the thread.
        expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual([
            "TEXT_MESSAGE_START", "TEXT_MESSAGE_CHUNK", "TEXT_MESSAGE_END", "RUN_FINISHED",
        ]);
        expect(onEvent.mock.lastCall?.[1]).toEqual(run?.messages);
    });

    it("ignores a second run in a conversation while one is going, and replaces a finished one", async () => {
        server.use(http.post("/api/search/chat", openResponse([{type: "RUN_STARTED", thread_id: "t-2"}])));
        const first = startRun({key: "t-2", threadId: "t-2", title: "t", messages: question, model: "m"});
        await vi.waitFor(() => expect(findRun(getChatRuns(), "t-2")).toBeDefined());

        await startRun({key: "t-2", threadId: "t-2", title: "t", messages: [], model: "m"});
        expect(getChatRuns()).toHaveLength(1);
        expect(findRun(getChatRuns(), "t-2")?.messages).toEqual(question);

        stopRun("t-2");
        await first;
        server.use(http.post("/api/search/chat", () => sseResponse(answer)));
        await startRun({key: "t-2", threadId: "t-2", title: "t", messages: question, model: "m"});
        expect(getChatRuns()).toHaveLength(1);
        expect(findRun(getChatRuns(), "t-2")?.status).toBe("finished");
    });

    it("stops a run on request and keeps what it had written", async () => {
        server.use(http.post("/api/search/chat", openResponse([
            {type: "RUN_STARTED", thread_id: "t-3"},
            {type: "TEXT_MESSAGE_START", message_id: "m1"},
            {type: "TEXT_MESSAGE_CHUNK", delta: "Partial"},
        ])));
        const done = startRun({key: "new-3", title: "t", messages: question, model: "m"});
        await vi.waitFor(() => expect(lastText("t-3")).toBe("Partial"));

        stopRun("t-3");
        await done;

        const run = findRun(getChatRuns(), "t-3");
        expect(run?.status).toBe("stopped");
        expect(lastText("t-3")).toBe("Partial");
        expect(run?.messages[1].isStreaming).toBe(false);
    });

    it("ends a failed run with an error bubble", async () => {
        server.use(http.post("/api/search/chat", () => new HttpResponse(null, {status: 503})));
        const onError = vi.fn();

        await startRun({key: "new-4", title: "t", messages: question, model: "m", onError});

        expect(onError).toHaveBeenCalledTimes(1);

        const run = findRun(getChatRuns(), "new-4");
        expect(run?.status).toBe("failed");
        expect(run?.messages[1]).toMatchObject({sender: "bot", isError: true});
        expect(run?.messages[1].content).toMatch(/Error 503/);
    });

    it("turns a legacy error event into an error bubble", async () => {
        server.use(http.post("/api/search/chat", () => sseResponse(sse([
            {type: "RUN_STARTED", thread_id: "t-6"},
            {type: "TEXT_MESSAGE_CHUNK", error: "LLM generation timed out"},
        ]))));

        await startRun({key: "new-6", title: "t", messages: question, model: "m"});

        expect(findRun(getChatRuns(), "t-6")?.status).toBe("failed");
        expect(lastText("t-6")).toMatch(/timed out/);
    });

    it("marks a finished run seen", async () => {
        server.use(http.post("/api/search/chat", () => sseResponse(answer)));
        await startRun({key: "new-5", title: "t", messages: question, model: "m"});

        markRunSeen("t-1");

        expect(findRun(getChatRuns(), "t-1")?.seen).toBe(true);
    });

    it("discards a running run, and the run's later events go nowhere", async () => {
        server.use(http.post("/api/search/chat", openResponse([{type: "RUN_STARTED", thread_id: "t-7"}])));
        const done = startRun({key: "new-7", title: "t", messages: question, model: "m"});
        await vi.waitFor(() => expect(findRun(getChatRuns(), "t-7")).toBeDefined());

        discardRun("t-7");
        await done;

        expect(getChatRuns()).toHaveLength(0);
    });

    it("asks before unloading the page only while a run is going", async () => {
        const add = vi.spyOn(window, "addEventListener");
        const remove = vi.spyOn(window, "removeEventListener");
        server.use(http.post("/api/search/chat", openResponse([{type: "RUN_STARTED", thread_id: "t-8"}])));

        const done = startRun({key: "new-8", title: "t", messages: question, model: "m"});
        expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));
        const warn = add.mock.calls.find(([type]) => type === "beforeunload")?.[1] as (e: Event) => void;
        const event = new Event("beforeunload", {cancelable: true});
        warn(event);
        expect(event.defaultPrevented).toBe(true);

        stopRun("new-8");
        await done;
        expect(remove).toHaveBeenCalledWith("beforeunload", warn);
    });
});
