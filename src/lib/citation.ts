import type {BackendDataset} from "../types/commons";

const sanitize = (value: string) => value.replace(/[{}]/g, "");

const firstCreatorLastName = (creators: string[]) => {

    if (!creators?.length) return "unknown";
    const first = creators[0];
    // Expect formats like "Last, First" or "First Last"
    if (first.includes(",")) {
        return first.split(",")[0].trim().replace(/\s+/g, "_");
    }
    const parts = first.trim().split(/\s+/);
    return parts.length ? parts[parts.length - 1] : "unknown";
};

const extractYear = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "n.d." : String(d.getUTCFullYear());
};

const formatAuthorsBibTeX = (creators: string[]) => {
    return creators?.map(c => c.replace(/\s+/g, ' ').trim()).join(" and ");
};

export const extractDOI = (url: string): string | undefined => {
    try {
        const u = new URL(url);
        if (u.hostname.includes('doi.org')) {
            return decodeURIComponent(u.pathname.replace(/^\//, ''));
        }
    } catch (err) {
        // Non-DOI or malformed URL; safe to ignore. Log in dev for diagnostics.
        if (typeof console !== 'undefined') {
            console.debug('extractDOI: unable to parse DOI from URL', url, err);
        }
    }
    return undefined;
};

// Content-Type headers for DOI citation API
const DOI_CONTENT_TYPES = {
    bibtex: 'application/x-bibtex', // Supported by all RAs
    ris: 'application/x-research-info-systems', // Supported by Crossref and DataCite
    csljson: 'application/vnd.citationstyles.csl+json', // Supported by all RAs
} as const;

// In-memory cache for DOI citations
// Key format: "doi|format"
const citationCache = new Map<string, string>();

/**
 * Fetch citation from DOI.org API with caching
 * @param doi - The DOI identifier (e.g., "10.1016/j.nimb.2023.03.031")
 * @param format - Citation format
 * @returns Citation string or null if failed
 */
export const fetchDOICitation = async (doi: string, format: keyof typeof DOI_CONTENT_TYPES): Promise<string | null> => {
    const cacheKey = `${doi}|${format}`;
    const cached = citationCache.get(cacheKey);
    if (cached) {
        console.debug(`Using cached citation for ${doi} (${format})`);
        return cached;
    }

    try {
        const response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
            headers: {
                'Accept': DOI_CONTENT_TYPES[format]
            }
        });

        if (!response.ok) {
            console.warn(`DOI API returned ${response.status} for ${doi}`);
            return null;
        }

        const text = await response.text();
        if (text) {
            // Store in cache
            citationCache.set(cacheKey, text);
            console.debug(`Cached citation for ${doi} (${format})`);
        }
        return text || null;
    } catch (error) {
        console.warn('Failed to fetch citation from DOI API:', error);
        return null;
    }
};
export const generateBibTeX = (ds: BackendDataset): string => {
    const year = extractYear(ds.publication_date);
    const creatorNames = (ds._source.creators ?? []).map(creator => creator.creatorName);
    const keyBase = `${firstCreatorLastName(creatorNames)}_${year}_${ds._id}`.replace(/[^A-Za-z0-9_]/g, "");
    const authors = formatAuthorsBibTeX(creatorNames);
    const doi = extractDOI(ds._id);
    const fields: Record<string, string | undefined> = {
        title: sanitize(ds.title || ''),
        author: authors || undefined,
        year: year !== 'n.d.' ? year : undefined,
        url: ds._id,
        note: `Accessed: ${new Date().toISOString().split('T')[0]}`,
        doi
    };
    const entries = Object.entries(fields).filter(([, v]) => !!v);
    const body = entries
        .map(([k, v], idx) => {
            const isLast = idx === entries.length - 1;
            return `  ${k} = {${sanitize(v!)}}${isLast ? '' : ','}`;
        })
        .join("\n");
    return `@misc{${keyBase},\n${body}\n}`;
};

export const generateRIS = (ds: BackendDataset): string => {
    const year = extractYear(ds.publication_date);
    const date = new Date(ds.publication_date);
    const datePart = isNaN(date.getTime()) ? '' : `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`;
    const doi = extractDOI(ds._id);
    const lines: string[] = [];
    lines.push('TY  - DATA');
    lines.push(`TI  - ${sanitize(ds.title)}`);
    ds._source.creators?.forEach(c => lines.push(`AU  - ${c.creatorName}`));
    if (year !== 'n.d.') lines.push(`PY  - ${year}`);
    if (datePart) lines.push(`DA  - ${datePart}`);
    if (doi) lines.push(`DO  - ${doi}`);
    lines.push(`UR  - ${ds._id}`);
    lines.push('ER  - ');
    return lines.join('\n');
};

export const generateEndNote = (ds: BackendDataset): string => {
    const year = extractYear(ds.publication_date);
    const doi = extractDOI(ds._id);
    const lines: string[] = [];
    lines.push('%0 Dataset');
    lines.push(`%T ${sanitize(ds.title)}`);
    ds._source.creators?.forEach(c => lines.push(`%A ${c.creatorName}`));
    if (year !== 'n.d.') lines.push(`%D ${year}`);
    if (doi) lines.push(`%R ${doi}`);
    lines.push(`%U ${ds._id}`);
    lines.push(`%~ Accessed ${new Date().toISOString().split('T')[0]}`);
    return lines.join('\n');
};

export const generateCSLJSON = (ds: BackendDataset): string => {
    const year = extractYear(ds.publication_date);
    const date = new Date(ds.publication_date);
    const dateParts = isNaN(date.getTime()) ? undefined : [[date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]];
    const authors = (ds._source.creators ?? []).map(c => ({literal: c.creatorName.trim()})).filter(a => a.literal.length);
    const obj: Record<string, unknown> = {
        type: 'dataset',
        id: ds._id,
        title: ds.title,
        author: authors.length ? authors : undefined,
        issued: dateParts ? {'date-parts': dateParts} : undefined,
        URL: ds._id,
        accessed: {'date-parts': [[new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, new Date().getUTCDate()]]},
        'original-date': year !== 'n.d.' ? {'date-parts': [[Number(year)]]} : undefined,
        keyword: ds._source.subjects && ds._source.subjects.length ? ds._source.subjects.map(subj => subj.subject).join(', ') : undefined,
        'container-title': undefined
    };
    // Remove undefined
    Object.keys(obj).forEach(k => obj[k] === undefined && delete obj[k]);
    return JSON.stringify(obj, null, 2);
};

export const generateRefWorks = (ds: BackendDataset): string => {
    // RefWorks Tagged Format (simplified)
    const year = extractYear(ds.publication_date);
    const lines: string[] = [];
    lines.push('RT Dataset');
    lines.push('SR Electronic');
    ds._source.creators?.forEach(c => lines.push(`A1 ${c.creatorName}`));
    lines.push(`T1 ${ds.title}`);
    if (year !== 'n.d.') lines.push(`YR ${year}`);
    if (ds._source.subjects) ds._source.subjects.slice(0, 15).forEach(kw => lines.push(`K1 ${kw.subject}`));
    lines.push(`UL ${ds._id}`);
    lines.push(`NO Accessed ${new Date().toISOString().split('T')[0]}`);
    lines.push('ER');
    return lines.join('\n');
};

export interface CitationBundle {
    bibtex: string;
    ris: string;
    endnote: string;
    csljson: string;
    refworks: string;
}

export const generateCitations = (ds: BackendDataset): CitationBundle => ({
    bibtex: generateBibTeX(ds),
    ris: generateRIS(ds),
    endnote: generateEndNote(ds),
    csljson: generateCSLJSON(ds),
    refworks: generateRefWorks(ds)
});