import {describe, it, expect} from "vitest";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {
    extractDOI,
    fetchDOICitation,
    fetchDOIFormattedCitation,
    formatCitation,
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

    it("falls back to publicationYear (not 1970) when publication_date is null", () => {
        // Regression: new Date(null) is the 1970 epoch, so a null date used to
        // emit `year = {1970}` while the card showed publicationYear (e.g. 2024).
        const bib = generateBibTeX(makeDataset({
            publication_date: null,
            _source: {publicationYear: "2024"},
        }));
        expect(bib).not.toContain("1970");
        expect(bib).toContain("year = {2024}");
        expect(bib).toContain("Doe_2024_");
    });

    it("omits year when both publication_date and publicationYear are absent", () => {
        const bib = generateBibTeX(makeDataset({
            publication_date: null,
            _source: {publicationYear: ""},
        }));
        expect(bib).not.toContain("year =");
        expect(bib).not.toContain("1970");
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

describe("fetchDOIFormattedCitation", () => {
    it("asks doi.org for the style's CSL name and reduces DataCite's markup to text", async () => {
        let acceptHeader: string | null = null;
        server.use(
            http.get("https://doi.org/:doi", ({request}) => {
                acceptHeader = request.headers.get("accept");
                return HttpResponse.text("Doe, J., &amp; Smith, J. (2023). <i>Ocean data</i> [Dataset]. Zenodo.");
            }),
        );
        const result = await fetchDOIFormattedCitation("10.1234/formatted.test", "chicago");
        expect(acceptHeader).toBe("text/x-bibliography; style=chicago-author-date; locale=en-US");
        expect(result).toBe("Doe, J., & Smith, J. (2023). Ocean data [Dataset]. Zenodo.");
    });

    it("returns null when the registration agency does not know the style", async () => {
        // Crossref answers an unknown style with 406.
        server.use(
            http.get("https://doi.org/:doi", () => HttpResponse.json({code: "style-not-found"}, {status: 406})),
        );
        expect(await fetchDOIFormattedCitation("10.1234/no.style", "vancouver")).toBeNull();
    });

    it("returns null when doi.org sends the landing page instead of a citation", async () => {
        server.use(
            http.get("https://doi.org/:doi", () => HttpResponse.html("<html><body>Dataset landing page</body></html>")),
        );
        expect(await fetchDOIFormattedCitation("10.1234/landing.page", "apa")).toBeNull();
        expect(await fetchDOICitation("10.1234/landing.page", "bibtex")).toBeNull();
    });
});

describe("formatCitation", () => {
    const doiLink = "https://doi.org/10.5281/zenodo.1234567";

    it.each([
        ["apa", `Doe, J., & Smith, J. (2023). Test Dataset Title [Data set]. ${doiLink}`],
        ["chicago", `Doe, Jane, and John Smith. 2023. “Test Dataset Title.” ${doiLink}.`],
        ["harvard", `Doe, J. and Smith, J. (2023) “Test Dataset Title.” Available at: ${doiLink}.`],
        ["mla", `Doe, Jane, and John Smith. “Test Dataset Title.” 2023, ${doiLink}.`],
        ["vancouver", `Doe J, Smith J. Test Dataset Title [Internet]. 2023. Available from: ${doiLink}`],
    ] as const)("formats a dataset in %s", (style, expected) => {
        expect(formatCitation(makeDataset(), style)).toBe(expected);
    });

    it("names the source repository as the publisher", () => {
        const ds = makeDataset({_source: {_repo: "ZENODO"}});
        expect(formatCitation(ds, "apa")).toBe(`Doe, J., & Smith, J. (2023). Test Dataset Title [Data set]. Zenodo. ${doiLink}`);
        expect(formatCitation(ds, "vancouver")).toContain("Test Dataset Title [Internet]. Zenodo; 2023.");
    });

    it("does not name an aggregator as the publisher", () => {
        const ds = makeDataset({_source: {_repo: "OPENAIRE"}});
        expect(formatCitation(ds, "apa")).not.toContain("OpenAIRE");
    });

    it("abbreviates given names, keeping hyphenated names and existing initials", () => {
        const ds = makeDataset({
            _source: {creators: [{creatorName: "Douzery, Emmanuel J.P."}, {creatorName: "Martin, Jean-Paul"}]},
        });
        expect(formatCitation(ds, "apa")).toMatch(/^Douzery, E\. J\. P\., & Martin, J\.-P\. \(2023\)/);
        expect(formatCitation(ds, "vancouver")).toMatch(/^Douzery EJP, Martin JP\. /);
    });

    it("keeps organisations and names without a comma whole", () => {
        const ds = makeDataset({
            _source: {
                creators: [
                    {creatorName: "European Space Agency, Earth Observation", nameType: "Organizational"},
                    {creatorName: "Jane Doe"},
                ],
            },
        });
        expect(formatCitation(ds, "apa")).toMatch(/^European Space Agency, Earth Observation, & Jane Doe \(2023\)/);
    });

    it("shortens long author lists the way each style does", () => {
        const creators = (n: number) => Array.from({length: n}, (_, i) => ({creatorName: `Author${i + 1}, Ann`}));
        const cite = (n: number, style: Parameters<typeof formatCitation>[1]) =>
            formatCitation(makeDataset({_source: {creators: creators(n)}}), style);

        expect(cite(20, "apa")).toContain("Author19, A., & Author20, A. (2023)");
        expect(cite(21, "apa")).toContain("Author19, A., . . . Author21, A. (2023)");
        expect(cite(21, "apa")).not.toContain("Author20");
        expect(cite(3, "harvard")).toMatch(/^Author1, A\., Author2, A\. and Author3, A\. \(2023\)/);
        expect(cite(4, "harvard")).toMatch(/^Author1, A\. et al\. \(2023\)/);
        expect(cite(2, "mla")).toMatch(/^Author1, Ann, and Ann Author2\. /);
        expect(cite(3, "mla")).toMatch(/^Author1, Ann, et al\. /);
        expect(cite(6, "chicago")).toMatch(/^Author1, Ann, Ann Author2, .*, and Ann Author6\. 2023\./);
        expect(cite(7, "chicago")).toMatch(/^Author1, Ann, Ann Author2, Ann Author3, et al\. 2023\./);
        expect(cite(7, "vancouver")).toMatch(/^Author1 A, .*, Author6 A, et al\. Test/);
    });

    it("leads with the title when there are no creators, and marks a missing date per style", () => {
        const ds = makeDataset({publication_date: null, _source: {creators: null, publicationYear: null}});
        expect(formatCitation(ds, "apa")).toBe(`Test Dataset Title [Data set]. (n.d.). ${doiLink}`);
        expect(formatCitation(ds, "chicago")).toBe(`“Test Dataset Title.” n.d. ${doiLink}.`);
        expect(formatCitation(ds, "harvard")).toBe(`“Test Dataset Title.” (no date) Available at: ${doiLink}.`);
        expect(formatCitation(ds, "mla")).toBe(`“Test Dataset Title.” ${doiLink}.`);
        expect(formatCitation(ds, "vancouver")).toBe(`Test Dataset Title [Internet]. Available from: ${doiLink}`);
    });

    it("links to the dataset URL when there is no DOI, and does not double a title's full stop", () => {
        const ds = makeDataset({_id: "https://example.org/dataset/1", title: "Ocean data."});
        expect(formatCitation(ds, "apa")).toBe("Doe, J., & Smith, J. (2023). Ocean data [Data set]. https://example.org/dataset/1");
        expect(formatCitation(ds, "harvard")).toContain("“Ocean data.”");
    });
});
