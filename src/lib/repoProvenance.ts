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
    /** Where the badge links to (the original repository / resource), when known. */
    href?: string | null;
}

const CDN = "https://cdn.eosc-data-commons.eu/app/uploads";

// ── Aggregator platforms (right logo, red box) ───────────────────────────────
// Only external crawler platforms that re-expose someone else's data. NOT the source repositories.
const PLATFORMS: Record<string, { name: string; logo: string | null }> = {
    // OneData has no EOSC CDN asset; use the project's canonical logo.
    ONE: {name: "Onedata", logo: "https://raw.githubusercontent.com/onedata/onedata/develop/resources/logo.png"},
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
// Keyed by the upstream `_repo` code. Official EOSC CDN assets from the Confluence "Data Model" page
// where they actually resolve. PaNOSC, EMPIAR, MDDB and DataverseLV have no usable CDN asset, so they
// hotlink the project's own logo instead: PaNOSC's CDN copy 302s to the homepage (never uploaded),
// EMPIAR has none, and the MDDB / DataverseLV marks are SVG, which the CDN's WordPress rejects on
// upload. A hotlinked URL can move without notice; LogoImg falls back to the repository name as text
// when an image fails to load, so that degrades quietly rather than breaking the badge.
const REPOSITORIES: Record<string, { name: string; logo: string | null }> = {
    DANS: {name: "DANS", logo: `${CDN}/2025/04/DANS.png`},
    HAL: {name: "HAL Open Science", logo: `${CDN}/2025/07/HAL.png`},
    PANOSC: {
        name: "PaNOSC",
        logo: "https://www.panosc.eu/wp-content/uploads/2024/09/PaNOSClogo_print_RGB-2024-1024x480.png"
    },
    ZENODO: {name: "Zenodo", logo: `${CDN}/2026/05/zenodo-gradient-2500.png`},
    DABAR: {name: "DABAR", logo: `${CDN}/2025/07/DABAR.png`},
    SWISS: {name: "SWISSUbase", logo: `${CDN}/2025/06/SwissUBase-1.png`},
    SWISSUBASE: {name: "SWISSUbase", logo: `${CDN}/2025/06/SwissUBase-1.png`},
    FINBIF: {name: "FinBIF", logo: `${CDN}/2025/07/FinBif.png`},
    DASCH: {name: "DaSCH", logo: `${CDN}/2025/07/DASCH.png`},
    EODC: {name: "EODC", logo: `${CDN}/2025/07/EODC-lightblue.png`},
    EMPIAR: {
        name: "EMPIAR",
        logo: "https://www.ebi.ac.uk/em_static/empiar/EMPIAR_logo_2017_black_font.png"
    },
    MDDB: {
        name: "MDDB",
        logo: "https://mddbr.eu/wp-content/uploads/2023/06/MDDB_Logo_colour.svg"
    },
    DATAVERSELV: {
        name: "DataverseLV",
        logo: "https://dataverse.lv/wp-content/uploads/2025/03/dataverseLV-1.svg"
    },
};

// ── Owner logos (left, for aggregated records) ───────────────────────────────
// Matched against the organizational creator's URL nameIdentifier. `href` overrides the link where a
// stakeholder asked for a specific landing page (e.g. EODC -> service portal).
// A `null` logo means we have no working asset yet, so the badge shows the owner name as text:
//   - Bgee: CDN file `2026/05/logo-bgee-v3.svg` is not actually uploaded (WordPress rejects SVG) and
//           the bgee.org source 403s hotlinks — pending a PNG re-upload to the CDN.
//   - CREATIS (VIP owner): no CDN asset and no stable source URL yet.
const OWNER_LOGOS: { match: string; name: string; logo: string | null; href?: string }[] = [
    {match: "eodc", name: "EODC", logo: `${CDN}/2025/07/EODC-lightblue.png`, href: "https://portal.services.eodc.eu"},
    {match: "ebi.ac.uk/gwas", name: "GWAS Catalog", logo: `${CDN}/2026/05/gwas-catalog-logo.jpg`},
    {match: "bgee.org", name: "Bgee", logo: null},                // TODO: swap in CDN URL once uploaded as PNG
    {match: "creatis.insa-lyon.fr", name: "CREATIS", logo: null}, // TODO: swap in CDN URL once available (VIP)
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
        href: mapped?.href ?? idUrl,
    };
}
