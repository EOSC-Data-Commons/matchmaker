import {describe, it, expect} from "vitest";
import {pangaeaReport} from "@/test/fixtures/fairReport";
import {
    CELL_PLAIN,
    CELL_PRINCIPLES,
    PRINCIPLE_CELLS,
    cellLabel,
    scoreBasis,
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
});

const resultFor = (assessor: AssessorId) => pangaeaReport.results.find(r => r.assessor === assessor)!;

describe("scoreBasis against real service output", () => {
    it("reports how many criteria stand behind a score", () => {
        // F-UJI scored Findable 100%, and did so on all four criteria.
        expect(resultFor("fuji").scores.f).toBe(100);
        expect(scoreBasis(resultFor("fuji"), "f")).toEqual({counted: 4, total: 4});
    });

    it("distinguishes a full score from a thin one", () => {
        // FAIR Champion reports 100% for Reusable, but from R1.1 alone.
        expect(resultFor("fair_champion").scores.r).toBe(100);
        expect(scoreBasis(resultFor("fair_champion"), "r")).toEqual({counted: 1, total: 3});
    });

    it("leaves out only the criteria each assessor derives", () => {
        // FAIR Champion combines A1 from its refinements, so it can measure three
        // Accessible criteria. F-UJI tests A1 itself, so all four count for it.
        expect(resultFor("fair_champion").derived).toEqual(["a1", "r1"]);
        expect(scoreBasis(resultFor("fair_champion"), "a").total).toBe(3);
        expect(resultFor("fuji").derived).toEqual([]);
        expect(scoreBasis(resultFor("fuji"), "a")).toEqual({counted: 1, total: 4});
    });

    it("never counts more criteria than exist", () => {
        for (const result of pangaeaReport.results) {
            for (const principle of Object.keys(PRINCIPLE_CELLS) as FairPrinciple[]) {
                const {counted, total} = scoreBasis(result, principle);
                expect(counted).toBeLessThanOrEqual(total);
            }
        }
    });
});
