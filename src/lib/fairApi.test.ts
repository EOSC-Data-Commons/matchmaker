import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {
    FairAssessmentTimeoutError,
    FairServiceUnavailableError,
    assessDataset,
    assessorsForPid,
    createAssessment,
    findLatestCompleted,
    getReport,
    isDoi,
    listAssessors,
    toPid,
    waitForAssessment,
} from "./fairApi";
import type {Assessment, AssessmentSummary} from "@/types/fairTypes";

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {
    });
});
afterEach(() => {
    vi.restoreAllMocks();
});

const summary = (over: Partial<AssessmentSummary> = {}): AssessmentSummary => ({
    id: "a1",
    pid: "10.1594/PANGAEA.908011",
    mode: "public",
    assessors: ["fuji", "fair_champion"],
    status: "completed",
    created_at: "2026-09-09T09:52:27Z",
    completed_at: "2026-09-09T09:52:50Z",
    ...over,
});

const assessment = (over: Partial<Assessment> = {}): Assessment => ({
    ...summary(),
    results: [],
    ...over,
} as Assessment);

describe("toPid", () => {
    it("trims and keeps a usable identifier", () => {
        expect(toPid("  https://doi.org/10.5281/zenodo.1  ")).toBe("https://doi.org/10.5281/zenodo.1");
    });

    it("returns null for absent or blank identifiers", () => {
        expect(toPid(null)).toBeNull();
        expect(toPid(undefined)).toBeNull();
        expect(toPid("   ")).toBeNull();
    });
});

describe("isDoi", () => {
    it.each([
        "10.1594/PANGAEA.908011",
        "https://doi.org/10.5281/zenodo.3477090",
        "http://dx.doi.org/10.5281/zenodo.1",
        "doi:10.14278/rodare.1",
    ])("recognises %s as a DOI", (pid) => {
        expect(isDoi(pid)).toBe(true);
    });

    it.each([
        "https://zenodo.org/records/3477090",
        "https://example.org/dataset/1",
        "ds-1",
    ])("rejects %s", (pid) => {
        expect(isDoi(pid)).toBe(false);
    });
});

describe("assessorsForPid", () => {
    it("runs both assessors for a DOI", () => {
        expect(assessorsForPid("https://doi.org/10.1594/PANGAEA.908011")).toEqual(["fuji", "fair_champion"]);
    });

    it("skips FAIR Champion without a DOI", () => {
        // Champion still completes on a plain URL, but takes minutes and returns
        // f: null and a: null, so it is not worth the wait.
        expect(assessorsForPid("https://zenodo.org/records/3477090")).toEqual(["fuji"]);
    });
});

describe("listAssessors", () => {
    it("returns the enabled assessors", async () => {
        server.use(http.get("/api/fair/assessors/", () =>
            HttpResponse.json([{id: "fuji", name: "F-UJI"}, {id: "fair_champion", name: "FAIR Champion"}])));
        await expect(listAssessors()).resolves.toEqual([
            {id: "fuji", name: "F-UJI"},
            {id: "fair_champion", name: "FAIR Champion"},
        ]);
    });

    it("maps 5xx to FairServiceUnavailableError", async () => {
        server.use(http.get("/api/fair/assessors/", () => new HttpResponse(null, {status: 503})));
        await expect(listAssessors()).rejects.toBeInstanceOf(FairServiceUnavailableError);
    });

    it("maps the proxy's plain-text 500 to FairServiceUnavailableError", async () => {
        // server.ts answers "Proxy error" as text/plain when the service is unreachable.
        server.use(http.get("/api/fair/assessors/", () =>
            new HttpResponse("Proxy error", {status: 500})));
        await expect(listAssessors()).rejects.toBeInstanceOf(FairServiceUnavailableError);
    });
});

describe("createAssessment", () => {
    it("defaults to public mode and reuses cached results", async () => {
        let body: unknown;
        server.use(http.post("/api/fair/assessments/", async ({request}) => {
            body = await request.json();
            return HttpResponse.json({id: "a1", status: "queued"});
        }));

        await expect(createAssessment({pid: "10.1"})).resolves.toEqual({id: "a1", status: "queued"});
        expect(body).toEqual({mode: "public", cached: true, pid: "10.1"});
    });

    it("lets the caller override the defaults", async () => {
        let body: Record<string, unknown> = {};
        server.use(http.post("/api/fair/assessments/", async ({request}) => {
            body = await request.json() as Record<string, unknown>;
            return HttpResponse.json({id: "a1", status: "queued"});
        }));

        await createAssessment({pid: "10.1", cached: false, assessors: ["fuji"]});
        expect(body.cached).toBe(false);
        expect(body.assessors).toEqual(["fuji"]);
    });

    it("surfaces the FastAPI detail on a 400", async () => {
        server.use(http.post("/api/fair/assessments/", () =>
            HttpResponse.json({detail: "Unknown assessor(s): ['nope']"}, {status: 400})));
        await expect(createAssessment({pid: "10.1"})).rejects.toThrow("Unknown assessor(s): ['nope']");
    });
});

describe("findLatestCompleted", () => {
    it("skips a still-running assessment and returns the newest finished one", async () => {
        // The service's own /latest endpoint would hand back the running record here,
        // which is why this goes through the list endpoint instead.
        server.use(http.get("/api/fair/assessments/", () => HttpResponse.json([
            summary({id: "running", status: "running", completed_at: null}),
            summary({id: "done", status: "completed"}),
        ])));
        await expect(findLatestCompleted("10.1")).resolves.toMatchObject({id: "done"});
    });

    it("accepts completed_with_errors, since one assessor may still have results", async () => {
        server.use(http.get("/api/fair/assessments/", () => HttpResponse.json([
            summary({id: "partial", status: "completed_with_errors"}),
        ])));
        await expect(findLatestCompleted("10.1")).resolves.toMatchObject({id: "partial"});
    });

    it("returns null when nothing has finished", async () => {
        server.use(http.get("/api/fair/assessments/", () => HttpResponse.json([
            summary({id: "queued", status: "queued", completed_at: null}),
        ])));
        await expect(findLatestCompleted("10.1")).resolves.toBeNull();
    });

    it("sends the pid as a query parameter", async () => {
        let url = "";
        server.use(http.get("/api/fair/assessments/", ({request}) => {
            url = request.url;
            return HttpResponse.json([]);
        }));
        await findLatestCompleted("https://doi.org/10.1594/PANGAEA.908011");
        expect(url).toContain("pid=https%3A%2F%2Fdoi.org%2F10.1594%2FPANGAEA.908011");
    });
});

describe("waitForAssessment", () => {
    it("polls until the run reaches a terminal state", async () => {
        const statuses = ["queued", "running", "completed"] as const;
        let call = 0;
        server.use(http.get("/api/fair/assessments/a1", () =>
            HttpResponse.json(assessment({status: statuses[Math.min(call++, 2)]}))));

        const progress: string[] = [];
        const result = await waitForAssessment("a1", {
            intervalMs: 1,
            onProgress: (a) => progress.push(a.status),
        });

        expect(result.status).toBe("completed");
        expect(progress).toEqual(["queued", "running", "completed"]);
    });

    it("resolves rather than throwing on completed_with_errors", async () => {
        // One assessor failing while the other succeeded is a normal outcome.
        server.use(http.get("/api/fair/assessments/a1", () =>
            HttpResponse.json(assessment({status: "completed_with_errors"}))));
        await expect(waitForAssessment("a1", {intervalMs: 1})).resolves.toMatchObject({
            status: "completed_with_errors",
        });
    });

    it("throws FairAssessmentTimeoutError once the deadline passes", async () => {
        server.use(http.get("/api/fair/assessments/a1", () =>
            HttpResponse.json(assessment({status: "running"}))));
        await expect(waitForAssessment("a1", {intervalMs: 1, timeoutMs: 0}))
            .rejects.toBeInstanceOf(FairAssessmentTimeoutError);
    });

    it("stops polling when the caller aborts", async () => {
        const controller = new AbortController();
        server.use(http.get("/api/fair/assessments/a1", () => {
            controller.abort();
            return HttpResponse.json(assessment({status: "running"}));
        }));
        await expect(waitForAssessment("a1", {intervalMs: 10, signal: controller.signal}))
            .rejects.toThrow(/abort/i);
    });
});

describe("getReport", () => {
    it("returns the harmonized report", async () => {
        server.use(http.get("/api/fair/assessments/a1/report", () => HttpResponse.json({
            id: "a1",
            pid: "10.1594/PANGAEA.908011",
            status: "completed",
            cells: [{cell: "f1", consensus: "pass", by_assessor: {fuji: "pass", fair_champion: "pass"}}],
            scores: {fuji: {f: 100, a: null, i: 100, r: 83.3, overall: 94.4}},
            guidance: [],
        })));

        const report = await getReport("a1");
        expect(report.cells[0].by_assessor).toEqual({fuji: "pass", fair_champion: "pass"});
        // A null principle means "not measurable", not zero — it has to survive the round trip.
        expect(report.scores.fuji?.a).toBeNull();
    });
});

describe("assessDataset", () => {
    it("reuses a finished assessment instead of queueing a new one", async () => {
        let posted = false;
        server.use(
            http.get("/api/fair/assessments/", () => HttpResponse.json([summary({id: "old"})])),
            http.post("/api/fair/assessments/", () => {
                posted = true;
                return HttpResponse.json({id: "new", status: "queued"});
            }),
            http.get("/api/fair/assessments/old/report", () =>
                HttpResponse.json({id: "old", pid: "10.1", status: "completed", cells: [], scores: {}, guidance: []})),
        );

        await expect(assessDataset("10.1")).resolves.toMatchObject({id: "old"});
        expect(posted).toBe(false);
    });

    it("queues a run when nothing has finished before", async () => {
        let requestedAssessors: unknown;
        server.use(
            http.get("/api/fair/assessments/", () => HttpResponse.json([])),
            http.post("/api/fair/assessments/", async ({request}) => {
                requestedAssessors = ((await request.json()) as Record<string, unknown>).assessors;
                return HttpResponse.json({id: "new", status: "queued"});
            }),
            http.get("/api/fair/assessments/new", () => HttpResponse.json(assessment({id: "new"}))),
            http.get("/api/fair/assessments/new/report", () =>
                HttpResponse.json({id: "new", pid: "10.1", status: "completed", cells: [], scores: {}, guidance: []})),
        );

        await expect(assessDataset("10.1594/PANGAEA.908011", {intervalMs: 1}))
            .resolves.toMatchObject({id: "new"});
        expect(requestedAssessors).toEqual(["fuji", "fair_champion"]);
    });

    it("still assesses when the reuse lookup fails", async () => {
        server.use(
            http.get("/api/fair/assessments/", () => new HttpResponse(null, {status: 503})),
            http.post("/api/fair/assessments/", () => HttpResponse.json({id: "new", status: "queued"})),
            http.get("/api/fair/assessments/new", () => HttpResponse.json(assessment({id: "new"}))),
            http.get("/api/fair/assessments/new/report", () =>
                HttpResponse.json({id: "new", pid: "10.1", status: "completed", cells: [], scores: {}, guidance: []})),
        );

        await expect(assessDataset("10.1", {intervalMs: 1})).resolves.toMatchObject({id: "new"});
    });

    it("skips the reuse lookup when asked for a fresh run", async () => {
        let listed = false;
        server.use(
            http.get("/api/fair/assessments/", () => {
                listed = true;
                return HttpResponse.json([summary({id: "old"})]);
            }),
            http.post("/api/fair/assessments/", () => HttpResponse.json({id: "new", status: "queued"})),
            http.get("/api/fair/assessments/new", () => HttpResponse.json(assessment({id: "new"}))),
            http.get("/api/fair/assessments/new/report", () =>
                HttpResponse.json({id: "new", pid: "10.1", status: "completed", cells: [], scores: {}, guidance: []})),
        );

        await assessDataset("10.1", {reuseExisting: false, intervalMs: 1});
        expect(listed).toBe(false);
    });
});
