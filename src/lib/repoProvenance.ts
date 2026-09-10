// Provenance of a search hit: which repository *owns* the dataset (left / "owner" logo, blue box)
// vs. which external platform *aggregated / crawled* it (right / "aggregator" logo, red box —
// OneData, and in future OpenAIRE / OpenAlex).
//
// Background (agreed in the Release-1 feedback thread): OneData crawls a third party's repository
// and re-exposes the records via OAI-PMH. Showing only the OneData logo makes it look as though the
// data was deposited *in* OneData, when it was merely harvested by it. So aggregated records get two
// logos: the real owner + the aggregator. Records harvested directly from a repository (DANS, HAL,
// PaNOSC, ...) keep a single repository logo — there is no third-party aggregator to disambiguate.
//
// Data available per hit (already returned by the backend, no BE change needed):
//   _repo         upstream repository code       e.g. "ONE" (OneData), "DANS", "HAL", "PANOSC"
//   _harvest_url  the OAI-PMH endpoint            e.g. "https://demo.onedata.org/oai_pmh"
//   url / _id     the record's own landing page
//   creators[]    DataCite creators. The owner is the creator with nameType "Organizational" and a
//                 nameIdentifier of scheme "URL" (e.g. "The Bgee Team" -> https://www.bgee.org/).

import type {BackendDataset} from "../types/commons.ts";

export interface RepoIdentity {
    /** Short stable code (repo code, or the owner's identifier host). */
    code: string;
    /** Human-readable name shown in tooltips / as text fallback. */
    name: string;
    /** Logo URL, or null when we only have a name (renders as text / initials). */
    logo: string | null;
    /** Optical size correction for the badge — see `logoScale`. Absent when there is no logo. */
    logoScale?: number;
    /** Where the badge links to (the original repository / resource), when known. */
    href?: string | null;
}

const CDN = "https://cdn.eosc-data-commons.eu/app/uploads";

/**
 * Per-logo optical size correction, applied by RepoProvenance on top of a plain object-contain fit.
 *
 * Logo files disagree about how much of themselves is logo. The media team's assets from
 * https://www.eosc-data-commons.eu/use-cases centre the mark on a uniform canvas with roughly a
 * third of the height as empty margin, so fitted whole they render their padding and shrink the mark
 * to ~12px. A logo hotlinked from a project's own site is cropped hard to the mark instead and
 * fills the badge edge to edge. Fitting both the same way is why the strip looked ragged: side by
 * side, marks came out anywhere from 20px to 96px wide.
 *
 * `logoScale` is the factor that brings each mark to the same *optical area* — the convention for a
 * row of mixed-aspect logos, since a wide wordmark and a square mark cannot match on both axes at
 * once. It is derived, not eyeballed: measure the ink bounding box of the file, work out the size it
 * lands at under object-contain in the 96x40 badge, and scale that to the width and height whose
 * product is a constant ~1500px² (capped at 92x36 so nothing touches the edges). Media assets come
 * out around 1.5-2.3x, tight ones around 0.6-1.0x.
 *
 * To add a logo, measure it the same way rather than guessing — a wrong number here reads as "that
 * one is the wrong size", which is exactly what this replaced.
 */
type LogoEntry = { name: string; logo: string | null; logoScale?: number };

// ── Aggregator platforms (right logo, red box) ───────────────────────────────
// Only external crawler platforms that re-expose someone else's data. NOT the source repositories.
const PLATFORMS: Record<string, LogoEntry> = {
    // No media asset for any aggregator yet; Onedata hotlinks the project's own mark.
    ONE: {
        name: "Onedata",
        logo: "https://raw.githubusercontent.com/onedata/onedata/develop/resources/logo.png",
        logoScale: 0.96,
    },
    // Named as future aggregators in the thread; no logo asset yet -> render as text.
    OPENAIRE: {name: "OpenAIRE", logo: null},
    OPENALEX: {name: "OpenAlex", logo: null},
};

const PLATFORM_HOSTS: { suffix: string; code: string }[] = [
    {suffix: "onedata.org", code: "ONE"},
    {suffix: "openaire.eu", code: "OPENAIRE"},
    {suffix: "openalex.org", code: "OPENALEX"},
];

// ── Source repositories (single logo when harvested directly, no aggregator) ──
// Keyed by the upstream `_repo` code. Every code the /stats endpoint reports as active has a logo
// here — "has a logo for every active repository" in the tests holds us to that, because a bare name
// next to the others' marks is exactly the raggedness this map exists to avoid.
const REPOSITORIES: Record<string, LogoEntry> = {
    // The media team's assets — the approved brand marks. Prefer one whenever it exists.
    DANS: {name: "DANS", logo: `${CDN}/2025/04/DANS.png`, logoScale: 1.66},
    HAL: {name: "HAL Open Science", logo: `${CDN}/2025/07/HAL.png`, logoScale: 2.03},
    DABAR: {name: "DABAR", logo: `${CDN}/2025/07/DABAR.png`, logoScale: 1.59},
    SWISS: {name: "SWISSUbase", logo: `${CDN}/2025/06/SwissUBase-1.png`, logoScale: 1.59},
    SWISSUBASE: {name: "SWISSUbase", logo: `${CDN}/2025/06/SwissUBase-1.png`, logoScale: 1.59},
    FINBIF: {name: "FinBIF", logo: `${CDN}/2025/07/FinBif.png`, logoScale: 1.57},
    DASCH: {name: "DaSCH", logo: `${CDN}/2025/07/DASCH.png`, logoScale: 1.68},
    EODC: {name: "EODC", logo: `${CDN}/2025/07/EODC-lightblue.png`, logoScale: 1.62},

    // Active repositories the media team has not published an asset for. These hotlink the project's
    // own logo, which can move without notice — swap in a media asset (and remeasure) once it exists.
    PANOSC: {
        name: "PaNOSC",
        logo: "https://www.panosc.eu/wp-content/uploads/2024/09/PaNOSClogo_print_RGB-2024-1024x480.png",
        logoScale: 0.78,
    },
    // The 2500px original is 1.3 MB; the CDN's 300px derivative is 16 KB and still 3x the badge.
    ZENODO: {name: "Zenodo", logo: `${CDN}/2026/05/zenodo-gradient-2500-300x120.png`, logoScale: 0.64},
    EMPIAR: {
        name: "EMPIAR",
        logo: "https://www.ebi.ac.uk/em_static/empiar/EMPIAR_logo_2017_black_font.png",
        logoScale: 0.81,
    },
    MDDB: {name: "MDDB", logo: "https://mddbr.eu/wp-content/uploads/2023/06/MDDB_Logo_colour.svg", logoScale: 0.65},
    DATAVERSELV: {
        name: "DataverseLV",
        logo: "https://dataverse.lv/wp-content/uploads/2025/03/dataverseLV-1.svg",
        logoScale: 0.96,
    },
};

// ── Owner logos (left, for aggregated records) ───────────────────────────────
// Matched against the organizational creator's URL nameIdentifier. `href` overrides the link where a
// stakeholder asked for a specific landing page (e.g. EODC -> service portal).
// Bgee and CREATIS were waiting on a usable asset and rendered as bare text; the media team's set
// supplies both. CREATIS runs the Virtual Imaging Platform and VIP is the mark published for it, so
// the badge shows the VIP logo under the owner name CREATIS.
const OWNER_LOGOS: { match: string; name: string; logo: string | null; logoScale?: number; href?: string }[] = [
    {
        match: "eodc", name: "EODC", logo: `${CDN}/2025/07/EODC-lightblue.png`, logoScale: 1.62,
        href: "https://portal.services.eodc.eu",
    },
    {match: "bgee.org", name: "Bgee", logo: `${CDN}/2025/07/BGEE-2.png`, logoScale: 1.45},
    {match: "creatis.insa-lyon.fr", name: "CREATIS", logo: `${CDN}/2025/07/VIP.png`, logoScale: 2.32},
    {match: "ebi.ac.uk/gwas", name: "GWAS Catalog", logo: `${CDN}/2026/05/gwas-catalog-logo.jpg`, logoScale: 0.75},
];

function hostnameOf(raw: string | null | undefined): string | null {
    if (!raw) return null;
    try {
        return new URL(raw).hostname.toLowerCase();
    } catch {
        return null;
    }
}

/** The external platform that aggregated/crawled the record (OneData, OpenAIRE, OpenAlex), or null. */
export function getAggregator(hit: BackendDataset): RepoIdentity | null {
    const src = hit._source;
    const code = src._repo?.toUpperCase();
    if (code && PLATFORMS[code]) {
        return {code, ...PLATFORMS[code]};
    }
    const host = hostnameOf(src._harvest_url);
    if (host) {
        const platform = PLATFORM_HOSTS.find(p => host.endsWith(p.suffix));
        if (platform) return {code: platform.code, ...PLATFORMS[platform.code]};
    }
    return null;
}

/** The source repository for directly-harvested records (single logo), or null. */
export function getRepository(hit: BackendDataset): RepoIdentity | null {
    const src = hit._source;
    const code = src._repo?.toUpperCase();
    if (!code) return null;
    const href = src.url || hit._id || null;
    if (REPOSITORIES[code]) {
        return {code, ...REPOSITORIES[code], href};
    }
    // Unknown code: surface it as text so the source is still shown.
    return {code, name: src._repo as string, logo: null, href};
}

/**
 * The single identity to name as "where this dataset comes from" when there is room for
 * only one: the owner of an aggregated record (the aggregator itself when the owner is
 * unknown), otherwise the source repository. Used by the chat's inline citations and
 * the "Cited from" strip, which cannot fit the two-logo cluster.
 */
export function getProvenanceSource(hit: BackendDataset): RepoIdentity | null {
    const aggregator = getAggregator(hit);
    if (aggregator) return getOwner(hit) ?? aggregator;
    return getRepository(hit);
}

/**
 * The institution that owns the dataset (left badge for aggregated records), from the DataCite
 * organizational creator with a URL nameIdentifier. Returns null when no such creator exists (e.g.
 * OneData records whose creators are only personal) — the badge then shows a neutral placeholder.
 */
export function getOwner(hit: BackendDataset): RepoIdentity | null {
    const creators = hit._source.creators || [];
    const hasUrlId = (c: (typeof creators)[number]) =>
        (c.nameIdentifiers || []).some(n => n.nameIdentifierScheme?.toUpperCase() === "URL" && n.nameIdentifier);

    // Prefer an organizational creator; fall back to any creator carrying a URL identifier.
    const owner =
        creators.find(c => c.nameType?.toLowerCase() === "organizational" && hasUrlId(c)) ||
        creators.find(hasUrlId);
    if (!owner) return null;

    const idUrl = (owner.nameIdentifiers || []).find(
        n => n.nameIdentifierScheme?.toUpperCase() === "URL" && n.nameIdentifier,
    )!.nameIdentifier;

    const key = idUrl.toLowerCase();
    const mapped = OWNER_LOGOS.find(o => key.includes(o.match));
    return {
        code: mapped?.match ?? hostnameOf(idUrl) ?? owner.creatorName,
        name: mapped?.name ?? owner.creatorName,
        logo: mapped?.logo ?? null,
        logoScale: mapped?.logoScale,
        href: mapped?.href ?? idUrl,
    };
}
