import type {BackendDataset, SearchHitSrcCreator} from "../types/commons";
import {getAggregator, getOwner, getRepository} from "./repoProvenance";

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

/**
 * Parse a publication date into a Date, or null when it is absent or invalid.
 * Guards two footguns: `new Date(null)` is the 1970 epoch (a valid Date, not
 * NaN), and `new Date("")` is Invalid — both must count as "no date".
 */
const parsePublicationDate = (dateStr?: string | null): Date | null => {
    const raw = dateStr?.trim();
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Citation year for a dataset: the year of a full publication date when we have
 * one, otherwise the `publicationYear` field (mirroring how SearchResultItem
 * shows the date on the card), otherwise "n.d.". A present-but-unparseable
 * publication_date yields "n.d." rather than a misleading year — notably a null
 * date must not become 1970.
 */
const citationYear = (ds: BackendDataset): string => {
    const d = parsePublicationDate(ds.publication_date);
    if (d) return String(d.getUTCFullYear());
    if (ds.publication_date?.trim()) return "n.d.";
    const year = ds._source?.publicationYear?.trim();
    return year && /^\d{4}$/.test(year) ? year : "n.d.";
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

/**
 * Citation styles offered as formatted text, with the CSL style doi.org formats each
 * one in. Check DataCite renders a style before adding it: DataCite answers a style
 * it does not know with APA rather than an error, so the label would be wrong.
 */
export const CITATION_STYLES = {
    apa: {label: 'APA', csl: 'apa'},
    chicago: {label: 'Chicago (author-date)', csl: 'chicago-author-date'},
    harvard: {label: 'Harvard', csl: 'harvard-cite-them-right'},
    mla: {label: 'MLA', csl: 'modern-language-association'},
    vancouver: {label: 'Vancouver', csl: 'vancouver'},
} as const;

export type CitationStyle = keyof typeof CITATION_STYLES;

// In-memory cache for DOI citations
// Key format: "doi|accept"
const citationCache = new Map<string, string>();

/**
 * Fetch one representation of a DOI from doi.org content negotiation, with caching.
 * @param doi - The DOI identifier (e.g., "10.1016/j.nimb.2023.03.031")
 * @param accept - The Accept header naming the representation
 * @returns Response text or null if failed
 */
const fetchFromDOI = async (doi: string, accept: string): Promise<string | null> => {
    const cacheKey = `${doi}|${accept}`;
    const cached = citationCache.get(cacheKey);
    if (cached) {
        console.debug(`Using cached citation for ${doi} (${accept})`);
        return cached;
    }

    try {
        const response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
            headers: {
                'Accept': accept
            }
        });

        if (!response.ok) {
            console.warn(`DOI API returned ${response.status} for ${doi}`);
            return null;
        }

        // A registration agency that cannot produce the requested type redirects to
        // the dataset's landing page instead, which is not a citation.
        if (response.headers.get('content-type')?.toLowerCase().startsWith('text/html')) {
            console.warn(`DOI API returned a web page instead of ${accept} for ${doi}`);
            return null;
        }

        const text = await response.text();
        if (text) {
            // Store in cache
            citationCache.set(cacheKey, text);
            console.debug(`Cached citation for ${doi} (${accept})`);
        }
        return text || null;
    } catch (error) {
        console.warn('Failed to fetch citation from DOI API:', error);
        return null;
    }
};

/**
 * Fetch a reference-manager citation (BibTeX, RIS, CSL JSON) for a DOI.
 * @returns Citation string or null if failed
 */
export const fetchDOICitation = (doi: string, format: keyof typeof DOI_CONTENT_TYPES): Promise<string | null> =>
    fetchFromDOI(doi, DOI_CONTENT_TYPES[format]);

/**
 * Fetch a citation for a DOI as formatted text in a citation style.
 *
 * DataCite marks the text up as HTML (an italic title, "&" escaped as "&amp;"), so
 * the response is parsed and reduced to its plain text. This runs in the browser only.
 * @returns Citation text or null if failed, e.g. when Crossref does not know the style
 */
export const fetchDOIFormattedCitation = async (doi: string, style: CitationStyle): Promise<string | null> => {
    const markup = await fetchFromDOI(doi, `text/x-bibliography; style=${CITATION_STYLES[style].csl}; locale=en-US`);
    if (!markup) return null;
    const text = new DOMParser().parseFromString(markup, 'text/html').body.textContent ?? '';
    return text.replace(/\s+/g, ' ').trim() || null;
};

export const generateBibTeX = (ds: BackendDataset): string => {
    const year = citationYear(ds);
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
    const year = citationYear(ds);
    const date = parsePublicationDate(ds.publication_date);
    const datePart = date ? `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}` : '';
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
    const year = citationYear(ds);
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
    const year = citationYear(ds);
    const date = parsePublicationDate(ds.publication_date);
    const dateParts = date ? [[date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]] : undefined;
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
    const year = citationYear(ds);
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

// ── Formatted text ───────────────────────────────────────────────────────────
// Local stand-ins for the formatted citations doi.org produces, for datasets
// without a DOI or whose registration agency cannot format them. Each follows the
// shape of DataCite's output for the same style, so both paths read alike; the
// title is plain text, as the italics in a style guide cannot be copied as text.

/** The dataset's DOI, from its doi.org URL or its DOI field. */
export const datasetDOI = (ds: BackendDataset): string | undefined =>
    extractDOI(ds._id) || ds._source.doi || undefined;

interface CitationName {
    family: string;
    // Absent for an organisation, or a name that could not be split.
    given?: string;
}

/**
 * Splits a creator into family and given names. DataCite writes personal names as
 * "Family, Given"; anything else is kept whole, since "Given Family" cannot be told
 * apart from an organisation's name.
 */
const parseCreatorName = (creator: SearchHitSrcCreator): CitationName | null => {
    const name = creator.creatorName?.replace(/\s+/g, ' ').trim();
    if (!name) return null;
    const comma = name.indexOf(',');
    if (comma > 0 && creator.nameType?.toLowerCase() !== 'organizational') {
        const given = name.slice(comma + 1).trim();
        return {family: name.slice(0, comma).trim(), given: given || undefined};
    }
    return {family: name};
};

// Initials per given name, keeping hyphenated names apart: "Jean-Paul E." -> [["J", "P"], ["E"]].
const initialsOf = (given: string): string[][] =>
    given.split(/[\s.]+/).filter(Boolean).map(word =>
        word.split('-').filter(Boolean).map(part => [...part][0].toUpperCase()));

// "Doe, J.-P. E." (APA, Harvard)
const familyInitials = ({family, given}: CitationName): string => {
    const initials = given ? initialsOf(given).map(word => word.map(i => `${i}.`).join('-')).join(' ') : '';
    return initials ? `${family}, ${initials}` : family;
};

// "Doe JPE" (Vancouver)
const familyBareInitials = ({family, given}: CitationName): string => {
    const initials = given ? initialsOf(given).flat().join('') : '';
    return initials ? `${family} ${initials}` : family;
};

// "Doe, Jane" for the first author, "John Smith" after it (MLA, Chicago)
const familyGiven = ({family, given}: CitationName): string => (given ? `${family}, ${given}` : family);
const givenFamily = ({family, given}: CitationName): string => (given ? `${given} ${family}` : family);

// Ends a sentence with a full stop, unless it already ends in one ("et al.", "J.") or in ? or !.
const sentence = (text: string): string => (/[.?!]$/.test(text) ? text : `${text}.`);

const quoted = (title: string): string => `“${sentence(title)}”`;

// "A, B, and C": the list form shared by APA (with "&"), Chicago and MLA.
const serialList = (names: string[], conjunction: string): string =>
    names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}, ${conjunction} ${names[names.length - 1]}`;

interface CitationParts {
    names: CitationName[];
    // A year, or "n.d."
    year: string;
    title: string;
    publisher?: string;
    link: string;
}

const FORMATTERS: Record<CitationStyle, (parts: CitationParts) => string> = {
    // APA 7: up to 20 authors; past that the first 19, an ellipsis, and the last.
    apa: ({names, year, title, publisher, link}) => {
        const list = names.map(familyInitials);
        const authors = list.length > 20
            ? `${list.slice(0, 19).join(', ')}, . . . ${list[list.length - 1]}`
            : serialList(list, '&');
        const titlePart = `${title} [Data set].`;
        const head = authors ? `${authors} (${year}). ${titlePart}` : `${titlePart} (${year}).`;
        return [head, publisher && sentence(publisher), link].filter(Boolean).join(' ');
    },
    // Chicago 18 author-date: up to six authors; past that the first three and et al.
    chicago: ({names, year, title, publisher, link}) => {
        const list = names.map((name, i) => (i === 0 ? familyGiven(name) : givenFamily(name)));
        const authors = list.length > 6 ? `${list.slice(0, 3).join(', ')}, et al.` : serialList(list, 'and');
        const head = authors ? [sentence(authors), sentence(year), quoted(title)] : [quoted(title), sentence(year)];
        return [...head, publisher && sentence(publisher), sentence(link)].filter(Boolean).join(' ');
    },
    // Harvard (Cite Them Right): up to three authors; from four the first and et al.
    harvard: ({names, year, title, publisher, link}) => {
        const list = names.map(familyInitials);
        const authors = list.length > 3
            ? `${list[0]} et al.`
            : list.length === 3 ? `${list[0]}, ${list[1]} and ${list[2]}` : list.join(' and ');
        const date = `(${year === 'n.d.' ? 'no date' : year})`;
        const head = authors ? `${authors} ${date} ${quoted(title)}` : `${quoted(title)} ${date}`;
        return [head, publisher && sentence(publisher), `Available at: ${sentence(link)}`].filter(Boolean).join(' ');
    },
    // MLA 9: up to two authors; from three the first and et al.
    mla: ({names, year, title, publisher, link}) => {
        const list = names.map((name, i) => (i === 0 ? familyGiven(name) : givenFamily(name)));
        const authors = list.length > 2 ? `${list[0]}, et al.` : serialList(list, 'and');
        const source = [publisher, year === 'n.d.' ? undefined : year, link].filter(Boolean).join(', ');
        return [authors && sentence(authors), quoted(title), sentence(source)].filter(Boolean).join(' ');
    },
    // Vancouver (NLM): up to six authors; past that the first six and et al.
    vancouver: ({names, year, title, publisher, link}) => {
        const list = names.map(familyBareInitials);
        const authors = list.length > 6 ? `${list.slice(0, 6).join(', ')}, et al.` : list.join(', ');
        const imprint = [publisher, year === 'n.d.' ? undefined : year].filter(Boolean).join('; ');
        return [authors && sentence(authors), `${title} [Internet].`, imprint && sentence(imprint), `Available from: ${link}`]
            .filter(Boolean).join(' ');
    },
};

/**
 * Who published the dataset: the repository a record was harvested from, or the
 * owner of an aggregated record. An aggregator (OpenAIRE, OneData) only indexed it.
 */
const publisherOf = (ds: BackendDataset): string | undefined =>
    (getAggregator(ds) ? getOwner(ds) : getRepository(ds))?.name || undefined;

/** A citation of the dataset as text in `style`, built from its search metadata. */
export const formatCitation = (ds: BackendDataset, style: CitationStyle): string => {
    const doi = datasetDOI(ds);
    const title = (ds.title || ds._source.titles?.[0]?.title || '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
    return FORMATTERS[style]({
        names: (ds._source.creators ?? []).map(parseCreatorName).filter((name): name is CitationName => !!name),
        year: citationYear(ds),
        title,
        publisher: publisherOf(ds),
        link: doi ? `https://doi.org/${doi}` : ds._id,
    });
};
