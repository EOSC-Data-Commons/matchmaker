import {describe, it, expect} from "vitest";
import {pangaeaReport} from "@/test/fixtures/fairReport";
import {
    CELL_PLAIN,
    CELL_PRINCIPLES,
    DERIVED_CELLS,
    PRINCIPLE_CELLS,
    cellLabel,
    recomputeScores,
    scorableCells,
    scoreBasis,
    totalBasis,
} from "./fairScoring";
import {FAIR_CELLS} from "@/types/fairTypes";
import type {AssessorId, FairPrinciple} from "@/types/fairTypes";

describe("reference data", () => {
    it("covers every criterion the service reports", () => {
        // A criterion with no text would render as a bare code.
        expect(Object.keys(CELL_PRINCIPLES).sort()).toEqual([...FAIR_CELLS].sort());
        expect(Object.keys(CELL_PLAIN).sort()).toEqual([...FAIR_CELLS].sort());
    });

    it("quotes the principles without dropping their qualifiers", () => {
        // Paraphrasing lost these on the first pass. They carry meaning an assessor
        // is judged on, so they are pinned here against a well-meant reword.
        expect(CELL_PRINCIPLES.a1_2).toContain("authentication and authorisation");
        expect(CELL_PRINCIPLES.r1).toContain("plurality of");
        expect(CELL_PRINCIPLES.i1).toContain("accessible");
        expect(CELL_PRINCIPLES.i1).toContain("broadly applicable");
        expect(CELL_PRINCIPLES.a1_1).toContain("universally implementable");
    });

    it("keeps the plain reading separate from the standard's own words", () => {
        // The gloss is ours; conflating the two would misrepresent the standard.
        for (const cell of FAIR_CELLS) {
            expect(CELL_PLAIN[cell]).not.toBe(CELL_PRINCIPLES[cell]);
            expect(CELL_PLAIN[cell].length).toBeGreaterThan(0);
        }
    });

    it("assigns every criterion to exactly one principle", () => {
        const assigned = Object.values(PRINCIPLE_CELLS).flat();
        expect(assigned.sort()).toEqual([...FAIR_CELLS].sort());
        expect(new Set(assigned).size).toBe(assigned.length);
    });

    it("writes criteria the way the FAIR principles are normally written", () => {
        expect(cellLabel("f1")).toBe("F1");
        expect(cellLabel("a1_1")).toBe("A1.1");
        expect(cellLabel("r1_3")).toBe("R1.3");
    });

    it("excludes the derived summaries from what can be scored", () => {
        expect(scorableCells("a")).toEqual(["a1_1", "a1_2", "a2"]);
        expect(scorableCells("r")).toEqual(["r1_1", "r1_2", "r1_3"]);
        expect(scorableCells("f")).toEqual(["f1", "f2", "f3", "f4"]);
        expect(DERIVED_CELLS.every(cell => !scorableCells("a").includes(cell))).toBe(true);
    });
});

describe("recomputeScores against real service output", () => {
    // The proxy returns scores but not what they were computed from, and the service
    // is fixed for now. These assertions are what licenses the card to state a basis:
    // if our arithmetic ever diverges from the service's, they fail.
    it.each(["fuji", "fair_champion"] as AssessorId[])(
        "reproduces %s's reported scores exactly",
        (assessor) => {
            expect(recomputeScores(pangaeaReport.cells, assessor))
                .toEqual(pangaeaReport.scores[assessor]);
        },
    );

    it("returns null for a principle nothing measured, rather than zero", () => {
        // F-UJI measured no Accessible criterion for this dataset.
        expect(recomputeScores(pangaeaReport.cells, "fuji").a).toBeNull();
        expect(scoreBasis(pangaeaReport.cells, "fuji", "a").counted).toBe(0);
    });
});

describe("scoreBasis", () => {
    it("reports how many criteria stand behind a score", () => {
        // F-UJI scored Findable 100%, and did so on all four criteria.
        expect(scoreBasis(pangaeaReport.cells, "fuji", "f")).toEqual({counted: 4, total: 4});
    });

    it("distinguishes a full score from a thin one", () => {
        // FAIR Champion also reports 100% for Accessible, but A1 is derived, so its
        // three refinements are the real basis.
        expect(scoreBasis(pangaeaReport.cells, "fair_champion", "a")).toEqual({counted: 3, total: 3});
    });

    it("counts nothing for an assessor that did not run", () => {
        const basis = scoreBasis(pangaeaReport.cells, "offline" as AssessorId, "f");
        expect(basis).toEqual({counted: 0, total: 4});
    });

    it("never counts more criteria than exist", () => {
        for (const assessor of ["fuji", "fair_champion"] as AssessorId[]) {
            for (const principle of Object.keys(PRINCIPLE_CELLS) as FairPrinciple[]) {
                const {counted, total} = scoreBasis(pangaeaReport.cells, assessor, principle);
                expect(counted).toBeLessThanOrEqual(total);
            }
        }
    });
});

describe("totalBasis", () => {
    it("sums the measurable criteria across all four principles", () => {
        // 13 scorable criteria in total: 15 minus the two derived summaries.
        expect(totalBasis(pangaeaReport.cells, "fuji").total).toBe(13);
        // F-UJI measured no Accessible criterion, so 3 of the 13 went unmeasured.
        expect(totalBasis(pangaeaReport.cells, "fuji").counted).toBe(10);
    });
});
