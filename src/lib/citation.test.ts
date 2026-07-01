import {describe, it, expect} from "vitest";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {
    extractDOI,
    fetchDOICitation,
    generateBibTeX,
    generateRIS,
    generateEndNote,
    generateCSLJSON,
    generateRefWorks,
    generateCitations,
} from "./citation";

describe("extractDOI", () => {
    it("extracts the DOI from a doi.org URL", () => {
        expect(extractDOI("https://doi.org/10.5281/zenodo.1234567")).toBe("10.5281/zenodo.1234567");
    });

    it("decodes percent-encoded DOI paths", () => {
        expect(extractDOI("https://doi.org/10.1000%2Fabc%20def")).toBe("10.1000/abc def");
    });

    it("returns undefined for non-DOI URLs", () => {
        expect(extractDOI("https://example.com/dataset/42")).toBeUndefined();
    });

    it("returns undefined for malformed URLs without throwing", () => {
        expect(extractDOI("not a url")).toBeUndefined();
        expect(extractDOI("")).toBeUndefined();
    });
});

describe("generateBibTeX", () => {
    it("produces a @misc entry with all fields for a complete dataset", () => {
        const bib = generateBibTeX(makeDataset());
        expect(bib).toMatch(/^@misc\{Doe_2023_/);
        expect(bib).toContain("title = {Test Dataset Title}");
        expect(bib).toContain("author = {Doe, Jane and Smith, John}");
        expect(bib).toContain("year = {2023}");
        expect(bib).toContain("url = {https://doi.org/10.5281/zenodo.1234567}");
        expect(bib).toContain("doi = {10.5281/zenodo.1234567}");
    });

    it("strips braces from titles so the BibTeX stays parseable", () => {
        const bib = generateBibTeX(makeDataset({title: "A {braced} title"}));
        expect(bib).toContain("title = {A braced title}");
    });

    it("omits year for unparseable publication dates", () => {
        const bib = generateBibTeX(makeDataset({publication_date: "not-a-date"}));
        expect(bib).not.toContain("year =");
    });

    it("omits the author field and uses an 'unknown' key when there are no creators", () => {
        const bib = generateBibTeX(makeDataset({_source: {creators: []}}));
        expect(bib).toMatch(/^@misc\{unknown_2023_/);
        expect(bib).not.toContain("author =");
    });

    it("handles null creators without throwing", () => {
        const bib = generateBibTeX(makeDataset({_source: {creators: null}}));
        expect(bib).toMatch(/^@misc\{unknown_2023_/);
        expect(bib).not.toContain("author =");
    });

    it("uses the last word as key name for 'First Last' style creators", () => {
        const bib = generateBibTeX(makeDataset({_source: {creators: [{creatorName: "Jane van Doe"}]}}));
        expect(bib).toMatch(/^@misc\{Doe_2023_/);
    });
});

describe("generateRIS", () => {
    it("produces a well-formed RIS record", () => {
        const ris = generateRIS(makeDataset());
        const lines = ris.split("\n");
        expect(lines[0]).toBe("TY  - DATA");
        expect(lines[lines.length - 1]).toBe("ER  - ");
        expect(ris).toContain("TI  - Test Dataset Title");
        expect(ris).toContain("AU  - Doe, Jane");
        expect(ris).toContain("AU  - Smith, John");
        expect(ris).toContain("PY  - 2023");
        expect(ris).toContain("DA  - 2023/05/17");
        expect(ris).toContain("DO  - 10.5281/zenodo.1234567");
        expect(ris).toContain("UR  - https://doi.org/10.5281/zenodo.1234567");
    });

    it("handles null creators without throwing", () => {
        const ris = generateRIS(makeDataset({_source: {creators: null}}));
        expect(ris).not.toContain("AU  -");
        expect(ris.split("\n")[0]).toBe("TY  - DATA");
    });

    it("omits PY and DA lines for unparseable dates", () => {
        const ris = generateRIS(makeDataset({publication_date: "n/a"}));
        expect(ris).not.toContain("PY  -");
        expect(ris).not.toContain("DA  -");
    });
});

describe("generateEndNote", () => {
    it("produces an EndNote record with authors and DOI", () => {
        const en = generateEndNote(makeDataset());
        expect(en).toContain("%0 Dataset");
        expect(en).toContain("%T Test Dataset Title");
        expect(en).toContain("%A Doe, Jane");
        expect(en).toContain("%D 2023");
        expect(en).toContain("%R 10.5281/zenodo.1234567");
    });
});

describe("generateCSLJSON", () => {
    it("produces valid CSL-JSON with authors, issued date and keywords", () => {
        const csl = JSON.parse(generateCSLJSON(makeDataset()));
        expect(csl.type).toBe("dataset");
        expect(csl.title).toBe("Test Dataset Title");
        expect(csl.author).toEqual([{literal: "Doe, Jane"}, {literal: "Smith, John"}]);
        expect(csl.issued).toEqual({"date-parts": [[2023, 5, 17]]});
        expect(csl.keyword).toBe("climate, oceanography");
    });

    it("handles null creators without throwing and omits author", () => {
        const csl = JSON.parse(generateCSLJSON(makeDataset({_source: {creators: null}})));
        expect(csl.author).toBeUndefined();
    });

    it("omits issued and keyword when date is invalid and subjects are absent", () => {
        const csl = JSON.parse(
            generateCSLJSON(makeDataset({publication_date: "unknown", _source: {subjects: null}})),
        );
        expect(csl.issued).toBeUndefined();
        expect(csl.keyword).toBeUndefined();
    });
});

describe("generateRefWorks", () => {
    it("produces a RefWorks record capped at 15 keywords", () => {
        const manySubjects = Array.from({length: 20}, (_, i) => ({subject: `kw${i}`}));
        const rw = generateRefWorks(makeDataset({_source: {subjects: manySubjects}}));
        expect(rw).toContain("RT Dataset");
        expect(rw).toContain("T1 Test Dataset Title");
        expect(rw.match(/^K1 /gm)).toHaveLength(15);
        const lines = rw.split("\n");
        expect(lines[lines.length - 1]).toBe("ER");
    });
});

describe("generateCitations", () => {
    it("bundles all five formats", () => {
        const bundle = generateCitations(makeDataset());
        expect(Object.keys(bundle).sort()).toEqual(["bibtex", "csljson", "endnote", "refworks", "ris"]);
        expect(bundle.bibtex).toContain("@misc{");
    });

    it("generates all formats for a dataset with null creators", () => {
        const bundle = generateCitations(makeDataset({_source: {creators: null}}));
        expect(Object.keys(bundle).sort()).toEqual(["bibtex", "csljson", "endnote", "refworks", "ris"]);
    });
});

describe("fetchDOICitation", () => {
    it("fetches a citation with the right Accept header", async () => {
        let acceptHeader: string | null = null;
        server.use(
            http.get("https://doi.org/:doi", ({request}) => {
                acceptHeader = request.headers.get("accept");
                return HttpResponse.text("@misc{remote_citation}");
            }),
        );
        const result = await fetchDOICitation("10.1234/fetch.test", "bibtex");
        expect(result).toBe("@misc{remote_citation}");
        expect(acceptHeader).toBe("application/x-bibtex");
    });

    it("caches successful responses per doi+format", async () => {
        let hits = 0;
        server.use(
            http.get("https://doi.org/:doi", () => {
                hits++;
                return HttpResponse.text("cached-value");
            }),
        );
        await fetchDOICitation("10.1234/cache.test", "ris");
        const second = await fetchDOICitation("10.1234/cache.test", "ris");
        expect(second).toBe("cached-value");
        expect(hits).toBe(1);
    });

    it("returns null on non-OK responses", async () => {
        server.use(
            http.get("https://doi.org/:doi", () => new HttpResponse(null, {status: 404})),
        );
        expect(await fetchDOICitation("10.1234/missing.test", "csljson")).toBeNull();
    });

    it("returns null on network errors", async () => {
        server.use(
            http.get("https://doi.org/:doi", () => HttpResponse.error()),
        );
        expect(await fetchDOICitation("10.1234/network.error", "bibtex")).toBeNull();
    });
});
