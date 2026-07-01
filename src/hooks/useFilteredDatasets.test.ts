import {describe, it, expect} from "vitest";
import {renderHook} from "@testing-library/react";
import {makeDataset} from "@/test/fixtures/datasets";
import {useFilteredDatasets} from "./useFilteredDatasets";

const ds = (id: string, year = "2023") =>
    makeDataset({_id: id, publication_date: `${year}-01-01`});

const noFilters = new URLSearchParams();
const year2023 = new URLSearchParams([["publicationYear", "2023"]]);

describe("useFilteredDatasets", () => {
    it("prefers reranked hits when they survive filtering", () => {
        const all = [ds("a"), ds("b")];
        const initial = {hits: [ds("a"), ds("b")], summary: ""};
        const reranked = {hits: [ds("b")], summary: ""};
        const {result} = renderHook(() =>
            useFilteredDatasets(all, initial, reranked, noFilters),
        );
        expect(result.current.datasets.map(d => d._id)).toEqual(["b"]);
    });

    it("falls back to filtered initial hits when filtering empties the reranked set", () => {
        const all = [ds("a", "2023"), ds("b", "2021")];
        const initial = {hits: [ds("a", "2023"), ds("b", "2021")], summary: ""};
        // Reranked only contains the 2021 dataset, which the filter removes
        const reranked = {hits: [ds("b", "2021")], summary: ""};
        const {result} = renderHook(() =>
            useFilteredDatasets(all, initial, reranked, year2023),
        );
        expect(result.current.filteredRerankedDatasets).toEqual([]);
        expect(result.current.datasets.map(d => d._id)).toEqual(["a"]);
    });

    it("applies filters to the combined list", () => {
        const all = [ds("a", "2023"), ds("b", "2021")];
        const {result} = renderHook(() =>
            useFilteredDatasets(all, null, null, year2023),
        );
        expect(result.current.filteredDatasets.map(d => d._id)).toEqual(["a"]);
    });

    it("returns null filtered sets when the corresponding results are absent", () => {
        const {result} = renderHook(() =>
            useFilteredDatasets([], null, null, noFilters),
        );
        expect(result.current.filteredInitialDatasets).toBeNull();
        expect(result.current.filteredRerankedDatasets).toBeNull();
        expect(result.current.datasets).toEqual([]);
    });

    it("returns an empty list when filters remove everything", () => {
        const all = [ds("a", "2021")];
        const initial = {hits: [ds("a", "2021")], summary: ""};
        const {result} = renderHook(() =>
            useFilteredDatasets(all, initial, null, year2023),
        );
        expect(result.current.datasets).toEqual([]);
    });
});
