import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, waitFor, within} from "@testing-library/react";
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
        http.get("/api/fair/assessments/a1", () => HttpResponse.json({
            ...summary(),
            results: [
                {assessor: "fuji", assessor_version: "3.5.0"},
                {assessor: "fair_champion", assessor_version: "0.5.8"},
            ],
        })),
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
        expect(screen.getByText(/showing an earlier assessment/i)).toBeInTheDocument();
    });

    it("shows an unmeasurable principle as not assessed rather than zero", async () => {
        // F-UJI returns a: null routinely; rendering that as 0% would libel the dataset.
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        const fuji = await screen.findByRole("group", {name: "F-UJI"});
        expect(within(fuji).getByText("not assessed")).toBeInTheDocument();
    });

    it("warns that only F-UJI runs without a DOI", async () => {
        noPreviousRuns();
        render(<FairAssessmentCard pid="https://zenodo.org/records/3477090"/>);
        expect(await screen.findByText(/no DOI, so only F-UJI/i)).toBeInTheDocument();
    });

    it("shows every check, passing ones included, with nothing to expand", async () => {
        // The card reports on openness; hiding most of its own evidence behind a
        // toggle would undercut the thing it measures.
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);

        expect(await screen.findByText(/does not contain its own identifier/i)).toBeInTheDocument();
        expect(screen.getByText("Add the identifier to the metadata record.")).toBeInTheDocument();
        // The passing check is present too, not filtered away.
        expect(screen.getByText("Data is assigned a persistent identifier")).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: /show details/i})).not.toBeInTheDocument();
    });

    it("counts the checks it is showing", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        expect(await screen.findByText(/2 checks, 1 not passing/)).toBeInTheDocument();
    });

    it("can narrow to failures on request, without that being the default", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);

        const filter = await screen.findByLabelText(/only show what did not pass/i);
        expect(filter).not.toBeChecked();

        await userEvent.click(filter);
        expect(screen.queryByText("Data is assigned a persistent identifier")).not.toBeInTheDocument();
        expect(screen.getByText(/does not contain its own identifier/i)).toBeInTheDocument();
    });

    it("states each assessor's verdict as text, not only on hover", async () => {
        // Tooltips are unreachable by keyboard and screen reader, and invisible on
        // touch, so the per-assessor verdicts live in a table instead.
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);

        const table = await screen.findByRole("table");
        const row = within(table).getByText("F3").closest("tr")!;
        // F-UJI passed F3 while FAIR Champion failed it: both verdicts are readable.
        expect(within(row).getByText("Pass")).toBeInTheDocument();
        expect(within(row).getByText("Fail")).toBeInTheDocument();
    });

    it("quotes each criterion from the standard and attributes it", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        expect(await screen.findByText(/globally unique and persistent identifier/i)).toBeInTheDocument();
        // Including criteria no assessor reported on, so their absence is visible.
        expect(screen.getByText(/meet domain-relevant community standards/i)).toBeInTheDocument();
        expect(screen.getByText(/Wilkinson et al., 2016/)).toBeInTheDocument();
        expect(screen.getByRole("link", {name: /GO FAIR Foundation/i}))
            .toHaveAttribute("href", "https://www.gofair.foundation/fair-principles");
    });

    it("marks the plain-language reading as ours, not the standard's", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        expect(await screen.findByText(/our plain-language reading of it, not part of the standard/i))
            .toBeInTheDocument();
    });

    it("says how much evidence each score rests on", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        // F-UJI reported on F1 and F3 in this fixture; the other two went unmeasured.
        const fuji = await screen.findByRole("group", {name: "F-UJI"});
        expect(within(fuji).getByText(/from 2 of 4 criteria/)).toBeInTheDocument();
        // The fixture has only F cells, so Accessible, Interoperable and Reusable each
        // say nothing was measured rather than showing a 0%.
        expect(within(fuji).getAllByText(/nothing measured of 3 criteria/)).toHaveLength(3);
    });

    it("shows when the assessment ran and which assessor versions produced it", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        expect(await screen.findByText(/F-UJI 3.5.0, FAIR Champion 0.5.8/)).toBeInTheDocument();
        expect(screen.getByText(/Assessed 9 September 2026/)).toBeInTheDocument();
    });

    it("links to the untouched assessor output", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        const link = await screen.findByRole("link", {name: /full assessor output/i});
        expect(link).toHaveAttribute("href", "/api/fair/assessments/a1/raw");
    });

    it("marks the derived criteria as not separately scored", async () => {
        withStoredReport();
        render(<FairAssessmentCard pid={DOI}/>);
        // A1 and R1 are combined from their refinements, so counting them would
        // count those refinements twice.
        expect((await screen.findAllByText(/not scored separately/i)).length).toBe(2);
    });

    it("flags a partial result when one assessor failed", async () => {
        withStoredReport({status: "completed_with_errors"});
        render(<FairAssessmentCard pid={DOI}/>);
        expect(await screen.findByText(/covers only the one that did/i)).toBeInTheDocument();
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
        expect(screen.queryByText(/showing an earlier assessment/i)).not.toBeInTheDocument();
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
