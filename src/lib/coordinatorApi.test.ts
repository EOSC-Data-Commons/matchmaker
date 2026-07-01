import {describe, it, expect, vi, afterEach} from "vitest";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import type {FileMeta, ToolConfig} from "@/types/dataplayerTypes";
import type {UserInfo} from "@/hooks/useAuth";
import {
    matchToolsByFiles,
    fetchFilesMetaByDatasetHandle,
    filePreviewUrl,
    fetchTextPreview,
    getToolById,
    searchToolsByText,
    startLaunchTask,
    getDispatchResultById,
} from "./coordinatorApi";

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

const toolConfig: ToolConfig = {
    name: "CSV Explorer",
    description: "Explore tabular data",
    slots: [],
    typ: "FilesOnly",
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe("matchToolsByFiles", () => {
    it("POSTs the files and returns the tool map", async () => {
        let body: { files: FileMeta[] } | undefined;
        server.use(http.post("/api/coordinator/tool/match", async ({request}) => {
            body = await request.json() as typeof body;
            return HttpResponse.json({"tool-1": toolConfig});
        }));
        const result = await matchToolsByFiles([makeFile()]);
        expect(result).toEqual({"tool-1": toolConfig});
        expect(body?.files).toHaveLength(1);
    });

    it("truncates to 10 files to stay under the payload limit, with a warning", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {
        });
        let body: { files: FileMeta[] } | undefined;
        server.use(http.post("/api/coordinator/tool/match", async ({request}) => {
            body = await request.json() as typeof body;
            return HttpResponse.json({});
        }));
        const files = Array.from({length: 14}, (_, i) => makeFile({filename: `f${i}.csv`}));
        await matchToolsByFiles(files);
        expect(body?.files).toHaveLength(10);
        expect(warn).toHaveBeenCalledOnce();
    });

    it("throws on backend errors", async () => {
        server.use(http.post("/api/coordinator/tool/match", () =>
            new HttpResponse(null, {status: 500, statusText: "Internal Server Error"}),
        ));
        await expect(matchToolsByFiles([makeFile()])).rejects.toThrow("Failed to match tools: 500");
    });
});

describe("fetchFilesMetaByDatasetHandle", () => {
    it("encodes the handle as a query param and returns the files", async () => {
        let handle: string | null = null;
        server.use(http.get("/api/coordinator/files", ({request}) => {
            handle = new URL(request.url).searchParams.get("handle");
            return HttpResponse.json([makeFile()]);
        }));
        const files = await fetchFilesMetaByDatasetHandle("hdl:21.12102/abc?x=1");
        expect(files).toHaveLength(1);
        expect(handle).toBe("hdl:21.12102/abc?x=1");
    });

    it("throws on backend errors", async () => {
        server.use(http.get("/api/coordinator/files", () => new HttpResponse(null, {status: 404})));
        await expect(fetchFilesMetaByDatasetHandle("h")).rejects.toThrow("Failed to fetch file metadata");
    });
});

describe("filePreviewUrl", () => {
    it("builds a same-origin proxy URL with the download URL encoded", () => {
        expect(filePreviewUrl("https://repo.example/f.csv?sig=a&b=c", "text"))
            .toBe("/api/coordinator/file-preview?mode=text&url=https%3A%2F%2Frepo.example%2Ff.csv%3Fsig%3Da%26b%3Dc");
    });

    it("defaults to binary mode", () => {
        expect(filePreviewUrl("https://repo.example/f.png")).toContain("mode=binary");
    });
});

describe("fetchTextPreview", () => {
    it("returns the text and the truncation flag from the header", async () => {
        server.use(http.get("/api/coordinator/file-preview", () =>
            HttpResponse.text("col1,col2\n1,2", {headers: {"X-Preview-Truncated": "1"}}),
        ));
        await expect(fetchTextPreview("https://repo.example/big.csv"))
            .resolves.toEqual({text: "col1,col2\n1,2", truncated: true});
    });

    it("reports truncated=false when the header is absent", async () => {
        server.use(http.get("/api/coordinator/file-preview", () => HttpResponse.text("all of it")));
        await expect(fetchTextPreview("https://repo.example/small.txt"))
            .resolves.toEqual({text: "all of it", truncated: false});
    });

    it("throws on proxy errors", async () => {
        server.use(http.get("/api/coordinator/file-preview", () => new HttpResponse(null, {status: 502})));
        await expect(fetchTextPreview("https://repo.example/f.txt")).rejects.toThrow("Failed to fetch preview: 502");
    });
});

describe("tool lookup", () => {
    it("getToolById fetches a single tool config", async () => {
        server.use(http.get("/api/coordinator/tool/get/tool-1", () => HttpResponse.json(toolConfig)));
        await expect(getToolById("tool-1")).resolves.toEqual(toolConfig);
    });

    it("getToolById throws on errors", async () => {
        server.use(http.get("/api/coordinator/tool/get/tool-1", () => new HttpResponse(null, {status: 404})));
        await expect(getToolById("tool-1")).rejects.toThrow("Failed to get tool: 404");
    });

    it("searchToolsByText encodes the query", async () => {
        let q: string | null = null;
        server.use(http.get("/api/coordinator/tool/search", ({request}) => {
            q = new URL(request.url).searchParams.get("q");
            return HttpResponse.json({"tool-1": toolConfig});
        }));
        await expect(searchToolsByText("csv & friends")).resolves.toEqual({"tool-1": toolConfig});
        expect(q).toBe("csv & friends");
    });
});

describe("task lifecycle", () => {
    const userInfo: UserInfo = {sub: "user-1", email: "jane@example.org", name: "Jane Doe"};

    it("startLaunchTask posts the full payload and returns the task id", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(http.post("/api/coordinator/start-task", async ({request}) => {
            body = await request.json() as typeof body;
            return HttpResponse.json("task-42");
        }));
        const taskId = await startLaunchTask(
            userInfo,
            "tool-1",
            "https://doi.org/10.5281/zenodo.1",
            "My Dataset",
            {threshold: 0.5},
            {input: makeFile()},
        );
        expect(taskId).toBe("task-42");
        expect(body).toMatchObject({
            userInfo,
            toolId: "tool-1",
            datasetUrl: "https://doi.org/10.5281/zenodo.1",
            datasetTitle: "My Dataset",
            slotMapping: {threshold: 0.5},
        });
    });

    it("startLaunchTask throws on failure", async () => {
        server.use(http.post("/api/coordinator/start-task", () => new HttpResponse(null, {status: 500})));
        await expect(startLaunchTask(userInfo, "t", "u", "d", {}, {})).rejects.toThrow("Failed to start task: 500");
    });

    it("getDispatchResultById wraps the plain-text URL in a DispatchResult", async () => {
        server.use(http.get("/api/coordinator/tasks-result/task-42", () =>
            HttpResponse.text("https://launch.example/session/9"),
        ));
        await expect(getDispatchResultById("task-42"))
            .resolves.toEqual({url: "https://launch.example/session/9"});
    });

    it("getDispatchResultById throws on failure", async () => {
        server.use(http.get("/api/coordinator/tasks-result/task-42", () => new HttpResponse(null, {status: 500})));
        await expect(getDispatchResultById("task-42")).rejects.toThrow("Failed to dispatch: 500");
    });
});
