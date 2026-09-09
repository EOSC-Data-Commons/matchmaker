import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {FairAssessmentCard} from "./FairAssessmentCard";
import type {AssessmentSummary, FairReport} from "@/types/fairTypes";

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {
    });
});
afterEach(() => {
    vi.restoreAllMocks();
});

const DOI = "https://doi.org/10.1594/PANGAEA.908011";

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

const report = (over: Partial<FairReport> = {}): FairReport => ({
    id: "a1",
    pid: "10.1594/PANGAEA.908011",
    status: "completed",
    cells: [
        {cell: "f1", consensus: "pass", by_assessor: {fuji: "pass", fair_champion: "pass"}},
        {cell: "f3", consensus: "fail", by_assessor: {fuji: "pass", fair_champion: "fail"}},
    ],
    scores: {
        fuji: {f: 100, a: null, i: 100, r: 83.3, overall: 94.4},
        fair_champion: {f: 33.3, a: 100, i: 100, r: 100, overall: 83.3},
    },
    guidance: [
        {
            assessor: "fair_champion",
            cell: "f3",
            test: "MetadataIdentifierFound",
            description: "The metadata contains an unambiguous reference to its own identifier",
            message: "Unacceptable.  The metadata does not contain its own identifier",
            outcome: "fail",
            guidance: ["Add the identifier to the metadata record."],
        },
        {
            assessor: "fuji",
            cell: "f1",
            test: "FsF-F1-01D",
            description: "Data is assigned a persistent identifier",
            message: null,
            outcome: "pass",
            guidance: [],
        },
    ],
    ...over,
});

/** No stored assessment: the card lands on its idle prompt. */
const noPreviousRuns = () =>
    server.use(http.get("/api/fair/assessments/", () => HttpResponse.json([])));

/** A stored, finished assessment the card can show immediately. */
const withStoredReport = (over: Partial<FairReport> = {}) =>
    server.use(
        http.get("/api/fair/assessments/", () => HttpResponse.json([summary()])),
        http.get("/api/fair/assessments/a1/report", () => HttpResponse.json(report(over))),
    );

describe("FairAssessmentCard", () => {
    it("renders nothing without a pid", () => {
        const {container} = render(<FairAssessmentCard pid={null}/>);
        expect(container).toBeEmptyDOMElement();
    });

    it("offers to run an assessment when the dataset has never been assessed", async () => {
        noPreviousRuns();
        render(<FairAssessmentCard pid={DOI}/>);
        expect(await screen.findByRole("button", {name: /check fair score/i})).toBeInTheDocument();
    });

    it("does not assess on mount", async () => {
        // A cold run costs 35s or more, so opening the dataplayer must not trigger one.
        let posted = false;
        server.use(
            http.get("/api/fair/assessments/", () => HttpResponse.json([])),
            http.post("/api/fair/assessments/", () => {
                posted = true;
                return HttpResponse.json({id: "new", status: "queued"});
            }),
        );

        render(<FairAssessmentCard pid={DOI}/>);
        await screen.findByRole("button", {name: /check fair score/i});
        expect(posted).toBe(false);
    });

    it("shows a stored assessment straight away", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);

        expect(await screen.findByText("94.4% overall")).toBeInTheDocument();
        expect(screen.getByText("83.3% overall")).toBeInTheDocument();
        expect(screen.getByText(/from an earlier assessment/i)).toBeInTheDocument();
    });

    it("shows an unmeasurable principle as not assessed rather than zero", async () => {
        // F-UJI returns a: null routinely; rendering that as 0% would libel the dataset.
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        expect(await screen.findByText("not assessed")).toBeInTheDocument();
    });

    it("warns that only F-UJI runs without a DOI", async () => {
        noPreviousRuns();
        render(<FairAssessmentCard pid="https://zenodo.org/records/3477090"/>);
        expect(await screen.findByText(/no DOI, so only F-UJI/i)).toBeInTheDocument();
    });

    it("reveals the criteria grid and failing guidance on demand", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);

        const toggle = await screen.findByRole("button", {name: /show details/i});
        // Only the failing check is counted, not the passing one.
        expect(toggle).toHaveTextContent("1 issues");
        await userEvent.click(toggle);

        expect(screen.getByText(/does not contain its own identifier/i)).toBeInTheDocument();
        expect(screen.getByText("Add the identifier to the metadata record.")).toBeInTheDocument();
        // Passing checks stay out of the guidance list.
        expect(screen.queryByText("Data is assigned a persistent identifier")).not.toBeInTheDocument();
    });

    it("exposes each assessor's own verdict, since the consensus is pessimistic", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        await userEvent.click(await screen.findByRole("button", {name: /show details/i}));

        // F3 is a consensus fail only because Champion failed it; F-UJI passed.
        const cell = screen.getByTitle(/^F3 — Fail/);
        expect(cell).toHaveAttribute("title", expect.stringContaining("F-UJI: pass"));
        expect(cell).toHaveAttribute("title", expect.stringContaining("FAIR Champion: fail"));
    });

    it("flags a partial result when one assessor failed", async () => {
        withStoredReport({status: "completed_with_errors"});
        render(<FairAssessmentCard pid={DOI}/>);
        expect(await screen.findByText(/based on partial results/i)).toBeInTheDocument();
    });

    it("runs an assessment when asked and shows the result", async () => {
        server.use(
            http.get("/api/fair/assessments/", () => HttpResponse.json([])),
            http.post("/api/fair/assessments/", () => HttpResponse.json({id: "new", status: "queued"})),
            http.get("/api/fair/assessments/new", () =>
                HttpResponse.json({
                    ...summary({id: "new"}),
                    results: [{assessor: "fuji"}, {assessor: "fair_champion"}]
                })),
            http.get("/api/fair/assessments/new/report", () => HttpResponse.json(report({id: "new"}))),
        );

        render(<FairAssessmentCard pid={DOI}/>);
        await userEvent.click(await screen.findByRole("button", {name: /check fair score/i}));

        expect(await screen.findByText("94.4% overall")).toBeInTheDocument();
        // A run in this session is not labelled as a stored one.
        expect(screen.queryByText(/from an earlier assessment/i)).not.toBeInTheDocument();
    });

    it("surfaces a failure with a way to retry", async () => {
        server.use(
            http.get("/api/fair/assessments/", () => HttpResponse.json([])),
            http.post("/api/fair/assessments/", () => new HttpResponse(null, {status: 503})),
        );

        render(<FairAssessmentCard pid={DOI}/>);
        await userEvent.click(await screen.findByRole("button", {name: /check fair score/i}));

        expect(await screen.findByText(/not available right now/i)).toBeInTheDocument();
        expect(screen.getByRole("button", {name: /try again/i})).toBeInTheDocument();
    });

    it("re-checks on request instead of reusing the stored result", async () => {
        let postedCached: unknown;
        withStoredReport();
        server.use(
            http.post("/api/fair/assessments/", async ({request}) => {
                postedCached = ((await request.json()) as Record<string, unknown>).cached;
                return HttpResponse.json({id: "new", status: "queued"});
            }),
            http.get("/api/fair/assessments/new", () =>
                HttpResponse.json({...summary({id: "new"}), results: []})),
            http.get("/api/fair/assessments/new/report", () => HttpResponse.json(report({id: "new"}))),
        );

        render(<FairAssessmentCard pid={DOI}/>);
        await userEvent.click(await screen.findByRole("button", {name: /re-check/i}));

        // Re-check must force a fresh run, not hand back what was already on screen.
        await waitFor(() => expect(postedCached).toBe(false));
    });
});
