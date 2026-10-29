import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {renderHook, waitFor, act} from "@testing-library/react";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {useTaskLauncher} from "./useDataplayerHooks";
import type {FileMeta} from "@/types/dataplayerTypes";

type Paq = Array<Array<string | number | boolean>>;
const paq = () => window._paq as unknown as Paq;
const events = () => paq().filter(c => c[0] === "trackEvent");

/**
 * Just enough of EventSource for the launcher: it registers a "state" listener,
 * sets onerror, and closes. Tests push task states through `emit`.
 */
class FakeEventSource {
    static instances: FakeEventSource[] = [];
    onerror: ((ev: Event) => void) | null = null;
    closed = false;
    private listeners: Record<string, Array<(ev: {data: string}) => void>> = {};

    constructor(readonly url: string) {
        FakeEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: (ev: {data: string}) => void) {
        (this.listeners[type] ??= []).push(listener);
    }

    close() {
        this.closed = true;
    }

    emit(state: string, message = "") {
        this.listeners.state?.forEach(l => l({data: JSON.stringify({state, message})}));
    }
}

const file: FileMeta = {
    dataPath: "data.csv", filename: "data.csv", size: "1 KB", hash: null, hash_type: "", isDir: false,
};

const callbacks = () => ({onState: vi.fn(), onSuccess: vi.fn(), onError: vi.fn()});

/** Starts a launch and returns the EventSource it opened, once the task id is back. */
const startLaunch = async (cb: ReturnType<typeof callbacks>) => {
    const {result} = renderHook(() => useTaskLauncher());
    act(() => {
        void result.current.launch("tool-1", "https://doi.org/10.1/x", "Title", {}, {"data.csv": file}, cb, "Jupyter");
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    return FakeEventSource.instances[0];
};

describe("useTaskLauncher analytics", () => {
    beforeEach(() => {
        window._paq = [];
        FakeEventSource.instances = [];
        vi.stubGlobal("EventSource", FakeEventSource);
        vi.spyOn(console, "error").mockImplementation(() => {});
        server.use(
            http.get("/auth/user", () => new HttpResponse(null, {status: 401})),
            http.post("/api/coordinator/start-task", () => HttpResponse.json("task-1")),
            http.get("/api/coordinator/tasks-result/task-1", () => HttpResponse.text("https://vre.example/run/1")),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        delete (window as Partial<Window>)._paq;
    });

    it("reports the submission with the tool name and the number of files mapped", async () => {
        await startLaunch(callbacks());
        expect(events()[0]).toEqual(["trackEvent", "Data Player", "launch_submitted", "Jupyter", 1]);
    });

    it("reports a READY task as a success timed from the submission", async () => {
        const cb = callbacks();
        const es = await startLaunch(cb);
        act(() => es.emit("READY"));
        await waitFor(() => expect(cb.onSuccess).toHaveBeenCalled());

        const [succeeded] = events().filter(c => c[2] === "launch_succeeded");
        expect(succeeded.slice(0, 4)).toEqual(["trackEvent", "Data Player", "launch_succeeded", "Jupyter"]);
        expect(typeof succeeded[4]).toBe("number");
        expect(events().some(c => c[2] === "launch_failed")).toBe(false);
    });

    it("names the task state that ended a failed launch", async () => {
        const cb = callbacks();
        const es = await startLaunch(cb);
        act(() => es.emit("EXCEPTION"));
        await waitFor(() => expect(cb.onError).toHaveBeenCalled());

        const [failed] = events().filter(c => c[2] === "launch_failed");
        expect(failed.slice(0, 4)).toEqual(["trackEvent", "Data Player", "launch_failed", "Jupyter:EXCEPTION"]);
        expect(typeof failed[4]).toBe("number");
    });

    it("reports a broken status stream as such", async () => {
        const cb = callbacks();
        const es = await startLaunch(cb);
        act(() => es.onerror?.(new Event("error")));
        await waitFor(() => expect(cb.onError).toHaveBeenCalled());
        expect(events().filter(c => c[2] === "launch_failed")[0][3]).toBe("Jupyter:stream_error");
    });

    it("reports a launch the coordinator refused by error kind", async () => {
        server.use(http.post("/api/coordinator/start-task", () => new HttpResponse(null, {status: 500})));
        const cb = callbacks();
        const {result} = renderHook(() => useTaskLauncher());
        await act(() => result.current.launch("tool-1", "u", "t", {}, {}, cb, "Jupyter"));

        expect(cb.onError).toHaveBeenCalled();
        expect(events().filter(c => c[2] === "launch_failed")[0][3]).toBe("Jupyter:unknown");
    });
});
