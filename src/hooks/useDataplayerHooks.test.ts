import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {renderHook, waitFor, act} from "@testing-library/react";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import type {FileMeta, ToolConfig, ToolSlot} from "@/types/dataplayerTypes";
import {
    buildSlotToFileMapping,
    areAllParametersMapped,
    useTaskLauncher,
    useDataset,
    useFilesToQueryTool,
    useSearchTextToQueryTool,
    useSelectedToolId,
} from "./useDataplayerHooks";

const makeFile = (overrides: Partial<FileMeta> = {}): FileMeta => ({
    downloadUrl: "https://repo.example/file.csv",
    dataPath: "/data/file.csv",
    filename: "file.csv",
    size: "1.2 MB",
    hash: null,
    hash_type: "md5",
    isDir: false,
    ...overrides,
});

const slot = (name: string, isOptional = false): ToolSlot =>
    ({name, typ: "File", id: name, isOptional});

const toolConfig: ToolConfig = {
    name: "CSV Explorer",
    description: "Explore tabular data",
    slots: [],
    typ: "FilesOnly",
};

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("buildSlotToFileMapping", () => {
    it("maps slot names to files by index", () => {
        const files = [makeFile({filename: "a.csv"}), makeFile({filename: "b.csv"})];
        const result = buildSlotToFileMapping({input: 1, extra: 0}, files);
        expect(result.input.filename).toBe("b.csv");
        expect(result.extra.filename).toBe("a.csv");
    });
});

describe("areAllParametersMapped", () => {
    it("is false without a config", () => {
        expect(areAllParametersMapped(null, {})).toBe(false);
    });

    it("requires every non-optional slot to be mapped", () => {
        const config: ToolConfig = {...toolConfig, slots: [slot("input"), slot("thresh")]};
        expect(areAllParametersMapped(config, {input: makeFile()})).toBe(false);
        expect(areAllParametersMapped(config, {input: makeFile(), thresh: 0.5})).toBe(true);
    });

    it("ignores optional slots", () => {
        const config: ToolConfig = {...toolConfig, slots: [slot("input"), slot("verbose", true)]};
        expect(areAllParametersMapped(config, {input: makeFile()})).toBe(true);
    });
});

describe("useDataset", () => {
    it("loads files for a dataset handle", async () => {
        server.use(http.get("/api/coordinator/files", () => HttpResponse.json([makeFile()])));
        const {result} = renderHook(() => useDataset("hdl:1/abc"));
        await waitFor(() => expect(result.current.isFilesLoading).toBe(false));
        expect(result.current.files).toHaveLength(1);
        expect(result.current.error).toBeNull();
    });

    it("reports a missing handle without fetching", async () => {
        const {result} = renderHook(() => useDataset(null));
        await waitFor(() => expect(result.current.isFilesLoading).toBe(false));
        expect(result.current.error).toBe("No dataset ID provided");
    });

    it("does nothing until enabled", () => {
        const {result} = renderHook(() => useDataset("hdl:1/abc", false));
        expect(result.current.isFilesLoading).toBe(true);
        expect(result.current.files).toEqual([]);
    });

    it("maps fetch failures to a friendly error", async () => {
        server.use(http.get("/api/coordinator/files", () => new HttpResponse(null, {status: 500})));
        const {result} = renderHook(() => useDataset("hdl:1/abc"));
        await waitFor(() => expect(result.current.isFilesLoading).toBe(false));
        expect(result.current.error).toBe("Failed to fetch files");
    });
});

describe("useFilesToQueryTool", () => {
    it("matches tools once files are present", async () => {
        server.use(http.post("/api/coordinator/tool/match", () =>
            HttpResponse.json({"tool-1": toolConfig}),
        ));
        // Stable reference: the effect depends on the files array identity, so
        // an inline array here would re-fetch on every render.
        const files = [makeFile()];
        const {result} = renderHook(() => useFilesToQueryTool(files));
        await waitFor(() => expect(result.current.queryToolResults).toEqual({"tool-1": toolConfig}));
    });

    it("skips matching with no files", async () => {
        let hits = 0;
        server.use(http.post("/api/coordinator/tool/match", () => {
            hits++;
            return HttpResponse.json({});
        }));
        renderHook(() => useFilesToQueryTool([]));
        await new Promise(r => setTimeout(r, 20));
        expect(hits).toBe(0);
    });
});

describe("useSearchTextToQueryTool", () => {
    it("debounces before querying and skips short inputs", async () => {
        const queries: string[] = [];
        server.use(http.get("/api/coordinator/tool/search", ({request}) => {
            queries.push(new URL(request.url).searchParams.get("q") ?? "");
            return HttpResponse.json({"tool-1": toolConfig});
        }));

        const {result, rerender} = renderHook(({text}) => useSearchTextToQueryTool(text), {
            initialProps: {text: "c"},
        });

        // Single character: debounce fires but the query is skipped
        await waitFor(() => expect(result.current.debouncedSearch).toBe("c"), {timeout: 2000});
        expect(queries).toEqual([]);

        rerender({text: "csv"});
        await waitFor(() => expect(result.current.queryToolResults).toEqual({"tool-1": toolConfig}), {timeout: 2000});
        expect(queries).toEqual(["csv"]);
    });
});

describe("useSelectedToolId", () => {
    it("loads the tool config when an id is selected", async () => {
        server.use(http.get("/api/coordinator/tool/get/tool-1", () => HttpResponse.json(toolConfig)));
        const {result} = renderHook(() => useSelectedToolId("tool-1"));
        await waitFor(() => expect(result.current.toolConfig).toEqual(toolConfig));
    });

    it("stays null with no selection", () => {
        const {result} = renderHook(() => useSelectedToolId(null));
        expect(result.current.toolConfig).toBeNull();
    });
});

describe("useTaskLauncher", () => {
    // taskStatusAsEventSource uses the EventSource global, which MSW cannot
    // intercept — substitute a controllable fake.
    class FakeEventSource {
        static instances: FakeEventSource[] = [];
        url: string;
        closed = false;
        onerror: ((err: unknown) => void) | null = null;
        private listeners = new Map<string, Array<(event: {data: string}) => void>>();

        constructor(url: string) {
            this.url = url;
            FakeEventSource.instances.push(this);
        }

        addEventListener(type: string, cb: (event: {data: string}) => void) {
            this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
        }

        close() {
            this.closed = true;
        }

        emit(type: string, data: object) {
            for (const cb of this.listeners.get(type) ?? []) cb({data: JSON.stringify(data)});
        }
    }

    beforeEach(() => {
        FakeEventSource.instances = [];
        vi.stubGlobal("EventSource", FakeEventSource);
        server.use(
            // useTaskLauncher pulls the user from useAuth
            http.get("/auth/user", () => HttpResponse.json({sub: "u1", email: "jane@example.org"})),
            http.post("/api/coordinator/start-task", () => HttpResponse.json("task-42")),
            http.get("/api/coordinator/tasks-result/task-42", () =>
                HttpResponse.text("https://launch.example/session/9")),
        );
    });

    const callbacks = () => ({onState: vi.fn(), onSuccess: vi.fn(), onError: vi.fn()});

    const launchTask = async (cbs: ReturnType<typeof callbacks>) => {
        const rendered = renderHook(() => useTaskLauncher());
        await act(() =>
            rendered.result.current.launch("tool-1", "https://doi.org/1", "DS", {}, {}, cbs),
        );
        return rendered;
    };

    it("starts the task and subscribes to its status stream", async () => {
        const cbs = callbacks();
        const {result} = await launchTask(cbs);

        expect(result.current.taskId).toBe("task-42");
        expect(FakeEventSource.instances).toHaveLength(1);
        expect(FakeEventSource.instances[0].url).toBe("/api/coordinator/task-status/task-42");

        act(() => FakeEventSource.instances[0].emit("state", {state: "RUNNING", message: "working"}));
        expect(cbs.onState).toHaveBeenCalledWith({state: "RUNNING", message: "working"});
        expect(cbs.onSuccess).not.toHaveBeenCalled();
    });

    it("fetches the dispatch result and closes the stream on READY", async () => {
        const cbs = callbacks();
        const {result} = await launchTask(cbs);

        await act(async () => {
            FakeEventSource.instances[0].emit("state", {state: "READY", message: "done"});
            // getDispatchResultById resolves asynchronously after the event
            await waitFor(() => expect(cbs.onSuccess).toHaveBeenCalled());
        });
        expect(result.current.taskResult).toEqual({url: "https://launch.example/session/9"});
        expect(FakeEventSource.instances[0].closed).toBe(true);
    });

    it.each(["EXCEPTION", "DROPPED"] as const)("reports failure on %s", async (state) => {
        const cbs = callbacks();
        await launchTask(cbs);

        act(() => FakeEventSource.instances[0].emit("state", {state, message: "boom"}));
        expect(cbs.onError).toHaveBeenCalledWith(new Error(`Task failed with state: ${state}`));
        expect(FakeEventSource.instances[0].closed).toBe(true);
    });

    it("reports stream errors through onError", async () => {
        const cbs = callbacks();
        await launchTask(cbs);

        act(() => FakeEventSource.instances[0].onerror?.(new Event("error")));
        expect(cbs.onError).toHaveBeenCalled();
        expect(FakeEventSource.instances[0].closed).toBe(true);
    });

    it("reports launch failures through onError", async () => {
        server.use(http.post("/api/coordinator/start-task", () => new HttpResponse(null, {status: 500})));
        const cbs = callbacks();
        const {result} = await launchTask(cbs);

        expect(cbs.onError).toHaveBeenCalled();
        expect(result.current.taskId).toBeNull();
    });

    it("resetTask clears the task state", async () => {
        const cbs = callbacks();
        const {result} = await launchTask(cbs);
        expect(result.current.taskId).toBe("task-42");

        act(() => result.current.resetTask());
        expect(result.current.taskId).toBeNull();
        expect(result.current.taskResult).toBeNull();
    });
});
