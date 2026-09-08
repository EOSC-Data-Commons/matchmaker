import {describe, it, expect} from "vitest";
import {getAggregator, getOwner, getProvenanceSource, getRepository} from "./repoProvenance";
import type {BackendDataset} from "../types/commons";

// Minimal hit builder — only the provenance-relevant fields matter here.
function hit(source: Partial<BackendDataset["_source"]> & { _id?: string }): BackendDataset {
    const {_id, ...src} = source;
    return {
        _id: _id ?? "",
        _source: {titles: [], descriptions: [], publicationYear: "", ...src},
        _score: 0,
    } as BackendDataset;
}

const bgeeCreator = [{
    creatorName: "The Bgee Team",
    nameType: "Organizational",
    nameIdentifiers: [{nameIdentifierScheme: "URL", nameIdentifier: "https://www.bgee.org/"}],
}];
const personalCreator = [{creatorName: "ishc-myeline", nameType: "Personal"}];

describe("getAggregator", () => {
    it("recognises external aggregation platforms from the repo code", () => {
        expect(getAggregator(hit({_repo: "ONE"}))?.name).toBe("Onedata");
        expect(getAggregator(hit({_repo: "openaire"}))?.name).toBe("OpenAIRE");
    });

    it("recognises a platform from the harvest-url host when the code is missing", () => {
        expect(getAggregator(hit({_harvest_url: "https://demo.onedata.org/oai_pmh"}))?.code).toBe("ONE");
    });

    it("returns null for direct repositories (no aggregator)", () => {
        expect(getAggregator(hit({_repo: "DANS", _harvest_url: "https://dataverse.nl/oai"}))).toBeNull();
        expect(getAggregator(hit({_repo: "HAL"}))).toBeNull();
    });
});

describe("getRepository", () => {
    it("maps known repo codes to a logo", () => {
        expect(getRepository(hit({_repo: "DANS"}))).toMatchObject({code: "DANS", name: "DANS"});
        expect(getRepository(hit({_repo: "hal"}))?.name).toBe("HAL Open Science");
        expect(getRepository(hit({_repo: "EMPIAR"}))).toMatchObject({
            code: "EMPIAR",
            name: "EMPIAR",
            logo: "https://www.ebi.ac.uk/em_static/empiar/EMPIAR_logo_2017_black_font.png",
        });
    });

    // The repository codes the /stats endpoint reports as active, minus ONE (Onedata),
    // which is an aggregator and so resolves through getAggregator instead. Each of these
    // reaches the badge, where a missing logo shows as bare text next to the others' marks.
    it("has a logo for every active repository", () => {
        const active = ["DANS", "PANOSC", "HAL", "MDDB", "EMPIAR", "SWISSUBASE",
            "ZENODO", "DABAR", "DATAVERSELV", "FINBIF", "DASCH"];
        const missing = active.filter(code => !getRepository(hit({_repo: code}))?.logo);
        expect(missing).toEqual([]);
    });

    it("links to the record's own landing page", () => {
        expect(getRepository(hit({_repo: "HAL", _id: "https://hal.inrae.fr/hal-1"}))?.href)
            .toBe("https://hal.inrae.fr/hal-1");
    });

    it("surfaces an unknown repo code as text", () => {
        expect(getRepository(hit({_repo: "FOO"}))).toMatchObject({code: "FOO", name: "FOO", logo: null});
    });

    it("returns null when no repo code is present", () => {
        expect(getRepository(hit({}))).toBeNull();
    });
});

describe("getOwner", () => {
    it("identifies the owner from the organizational creator's URL identifier", () => {
        const owner = getOwner(hit({_repo: "ONE", creators: bgeeCreator}));
        expect(owner).toMatchObject({name: "Bgee", href: "https://www.bgee.org/"});
    });

    it("uses the creator name when the owner domain isn't mapped", () => {
        const owner = getOwner(hit({
            creators: [{
                creatorName: "Some Lab",
                nameType: "Organizational",
                nameIdentifiers: [{nameIdentifierScheme: "URL", nameIdentifier: "https://some-lab.example/"}],
            }],
        }));
        expect(owner).toMatchObject({name: "Some Lab", href: "https://some-lab.example/"});
    });

    it("overrides the link for EODC", () => {
        const owner = getOwner(hit({
            creators: [{
                creatorName: "EODC",
                nameType: "Organizational",
                nameIdentifiers: [{nameIdentifierScheme: "URL", nameIdentifier: "https://eodc.eu/"}],
            }],
        }));
        expect(owner?.href).toBe("https://portal.services.eodc.eu");
    });

    it("returns null when there is no organizational creator (personal only)", () => {
        expect(getOwner(hit({_repo: "ONE", creators: personalCreator}))).toBeNull();
    });

    it("ignores non-URL identifiers such as ORCID", () => {
        expect(getOwner(hit({
            creators: [{
                creatorName: "Pluchot, Camille",
                nameType: "Personal",
                nameIdentifiers: [{nameIdentifierScheme: "ORCID", nameIdentifier: "0009-0005-7532-6624"}],
            }],
        }))).toBeNull();
    });
});

describe("getProvenanceSource", () => {
    it("names the source repository of a directly harvested record", () => {
        expect(getProvenanceSource(hit({_repo: "HAL"}))?.name).toBe("HAL Open Science");
        expect(getProvenanceSource(hit({_repo: "EMPIAR"}))?.name).toBe("EMPIAR");
        // Unknown code: still named, as text.
        expect(getProvenanceSource(hit({_repo: "FOO"}))?.name).toBe("FOO");
    });

    it("names the owner of an aggregated record, or the aggregator when the owner is unknown", () => {
        expect(getProvenanceSource(hit({_repo: "ONE", creators: bgeeCreator}))?.name).toBe("Bgee");
        expect(getProvenanceSource(hit({_repo: "ONE", creators: personalCreator}))?.name).toBe("Onedata");
    });

    it("is null when nothing is known", () => {
        expect(getProvenanceSource(hit({}))).toBeNull();
    });
});
