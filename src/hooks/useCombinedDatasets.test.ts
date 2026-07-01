import {describe, it, expect} from "vitest";
import {renderHook} from "@testing-library/react";
import {makeDataset} from "@/test/fixtures/datasets";
import {useCombinedDatasets} from "./useCombinedDatasets";

const ds = (id: string, year = "2023") =>
    makeDataset({_id: id, publication_date: `${year}-01-01`});

describe("useCombinedDatasets", () => {
    it("merges reranked and initial hits, deduplicating by _id with reranked first", () => {
        const reranked = {hits: [ds("a"), ds("b")], summary: ""};
        const initial = {hits: [ds("b"), ds("c")], summary: ""};
        const {result} = renderHook(() =>
            useCombinedDatasets(initial, reranked, new URLSearchParams()),
        );
        expect(result.current.allCombinedDatasets.map(d => d._id)).toEqual(["a", "b", "c"]);
    });

    it("returns empty aggregations when there are no datasets", () => {
        const {result} = renderHook(() =>
            useCombinedDatasets(null, null, new URLSearchParams()),
        );
        expect(result.current.allCombinedDatasets).toEqual([]);
        expect(result.current.aggregations).toEqual({});
    });

    it("builds aggregations from the combined set", () => {
        const initial = {hits: [ds("a", "2021"), ds("b", "2023")], summary: ""};
        const {result} = renderHook(() =>
            useCombinedDatasets(initial, null, new URLSearchParams()),
        );
        expect(result.current.aggregations.publicationYear?.buckets.map(b => b.key))
            .toEqual(["2023", "2021"]);
    });

    it("keeps the combined array referentially stable across unrelated rerenders", () => {
        const initial = {hits: [ds("a")], summary: ""};
        const filters = new URLSearchParams();
        const {result, rerender} = renderHook(() =>
            useCombinedDatasets(initial, null, filters),
        );
        const first = result.current.allCombinedDatasets;
        rerender();
        expect(result.current.allCombinedDatasets).toBe(first);
    });
});
