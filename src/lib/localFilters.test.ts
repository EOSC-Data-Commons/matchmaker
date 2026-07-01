import {describe, it, expect} from "vitest";
import {makeDataset} from "@/test/fixtures/datasets";
import {applyLocalFilters, generateDynamicFilters} from "./localFilters";

const datasets = [
    makeDataset({
        _id: "ds-1",
        publication_date: "2023-05-17",
        _source: {
            creators: [{creatorName: "Doe, Jane"}],
            subjects: [{subject: "climate"}],
        },
    }),
    makeDataset({
        _id: "ds-2",
        publication_date: "2021-01-01",
        _source: {
            creators: [{creatorName: "Smith, John"}],
            subjects: [{subject: "oceanography"}],
        },
    }),
    makeDataset({
        _id: "ds-3",
        // No top-level date: must fall back to _source.publicationYear
        publication_date: null,
        _source: {
            publicationYear: "2023",
            creators: [{creatorName: "Doe, Jane"}, {creatorName: "Smith, John"}],
            subjects: [{subject: "climate"}, {subject: "geology"}],
        },
    }),
];

const params = (entries: [string, string][]) => new URLSearchParams(entries);

describe("applyLocalFilters", () => {
    it("returns all datasets when no filters are selected", () => {
        expect(applyLocalFilters(datasets, params([]))).toHaveLength(3);
    });

    it("filters by publication year, using _source.publicationYear as fallback", () => {
        const result = applyLocalFilters(datasets, params([["publicationYear", "2023"]]));
        expect(result.map(d => d._id)).toEqual(["ds-1", "ds-3"]);
    });

    it("treats multiple values of the same filter as OR", () => {
        const result = applyLocalFilters(datasets, params([
            ["publicationYear", "2023"],
            ["publicationYear", "2021"],
        ]));
        expect(result).toHaveLength(3);
    });

    it("filters by creator name", () => {
        const result = applyLocalFilters(datasets, params([["creator", "Smith, John"]]));
        expect(result.map(d => d._id)).toEqual(["ds-2", "ds-3"]);
    });

    it("filters by subject", () => {
        const result = applyLocalFilters(datasets, params([["subject", "geology"]]));
        expect(result.map(d => d._id)).toEqual(["ds-3"]);
    });

    it("combines different filter types with AND", () => {
        const result = applyLocalFilters(datasets, params([
            ["publicationYear", "2023"],
            ["creator", "Smith, John"],
        ]));
        expect(result.map(d => d._id)).toEqual(["ds-3"]);
    });

    it("excludes datasets without a resolvable year when a year filter is active", () => {
        const noDate = makeDataset({
            _id: "ds-no-date",
            publication_date: null,
            _source: {publicationYear: ""},
        });
        const result = applyLocalFilters([noDate], params([["publicationYear", "2023"]]));
        expect(result).toHaveLength(0);
    });

    it("skips the excluded filter key so its own facet options stay complete", () => {
        const result = applyLocalFilters(
            datasets,
            params([["publicationYear", "2021"]]),
            "publicationYear",
        );
        expect(result).toHaveLength(3);
    });
});

describe("generateDynamicFilters", () => {
    it("aggregates all facets with no active filters", () => {
        const aggs = generateDynamicFilters(datasets, params([]));
        expect(aggs.publicationYear?.buckets).toEqual([
            {key: "2023", label: "2023", doc_count: 2},
            {key: "2021", label: "2021", doc_count: 1},
        ]);
        const authors = Object.fromEntries(
            aggs.creator!.buckets.map(b => [b.key, b.doc_count]),
        );
        expect(authors).toEqual({"Doe, Jane": 2, "Smith, John": 2});
        const subjects = Object.fromEntries(
            aggs.subject!.buckets.map(b => [b.key, b.doc_count]),
        );
        expect(subjects).toEqual({climate: 2, oceanography: 1, geology: 1});
    });

    it("sorts year buckets descending by year, not by count", () => {
        const aggs = generateDynamicFilters(datasets, params([]));
        expect(aggs.publicationYear!.buckets.map(b => b.key)).toEqual(["2023", "2021"]);
    });

    it("does not narrow a facet by its own selection", () => {
        // With year=2021 selected, the year facet must still offer 2023,
        // but authors/subjects should only count 2021 datasets.
        const aggs = generateDynamicFilters(datasets, params([["publicationYear", "2021"]]));
        expect(aggs.publicationYear!.buckets.map(b => b.key)).toEqual(["2023", "2021"]);
        expect(aggs.creator!.buckets).toEqual([
            {key: "Smith, John", label: "Smith, John", doc_count: 1},
        ]);
        expect(aggs.subject!.buckets).toEqual([
            {key: "oceanography", label: "oceanography", doc_count: 1},
        ]);
    });

    it("narrows each facet by the other active filters", () => {
        const aggs = generateDynamicFilters(datasets, params([["creator", "Doe, Jane"]]));
        // Year counts restricted to Jane Doe's datasets (ds-1, ds-3)
        expect(aggs.publicationYear!.buckets).toEqual([
            {key: "2023", label: "2023", doc_count: 2},
        ]);
    });

    it("caps author buckets at 20 and subject buckets at 15", () => {
        const many = Array.from({length: 30}, (_, i) =>
            makeDataset({
                _id: `ds-${i}`,
                _source: {
                    creators: [{creatorName: `Author ${i}`}],
                    subjects: [{subject: `subject-${i}`}],
                },
            }),
        );
        const aggs = generateDynamicFilters(many, params([]));
        expect(aggs.creator!.buckets).toHaveLength(20);
        expect(aggs.subject!.buckets).toHaveLength(15);
    });

    it("omits facets that have no buckets", () => {
        const bare = makeDataset({
            publication_date: null,
            _source: {publicationYear: "", creators: [], subjects: []},
        });
        const aggs = generateDynamicFilters([bare], params([]));
        expect(aggs).toEqual({});
    });
});
