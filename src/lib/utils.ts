import type {BackendDataset} from "@/types/commons.ts";
// Logger utility for error handling and messaging

// Define isDev based on Vite's import.meta.env or Node's process.env
const isDev = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.MODE === 'development'
    : process.env.NODE_ENV === 'development';

export function logError(error: unknown, context?: string) {
    if (isDev) {
        // Detailed error in dev
        console.error(`[DEV ERROR]${context ? ' [' + context + ']' : ''}`, error);
    } else {
        // User-friendly error in prod
        console.error(`[ERROR]${context ? ' [' + context + ']' : ''}`, error instanceof Error ? error.message : String(error));
    }
}

export function getUserErrorMessage(error: unknown): string {
    if (isDev && error instanceof Error) {
        return `${error.message}\n${error.stack}`;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred.';
}


/**
 * Wraps a fetch call with a timeout
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 60000 = 1 minute)
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = 60000
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs / 1000} seconds. Please try again.`);
        }
        throw error;
    }
}

/**
 * Strips HTML tags and decodes basic HTML entities.
 * Safe for use in both browser and server environments (SSR).
 */
export function stripHtml(html: string): string {
    if (!html) return '';

    let text = html.replace(/<(script|style|noscript|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '');
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/<[^>]+>/g, '');
    const entities: Record<string, string> = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™',
        '&bull;': '•',
        '&middot;': '·',
    };

    return text.replace(/&(nbsp|amp|lt|gt|quot|#39|apos|copy|reg|trade|bull|middot);/g, (match) => {
        return entities[match] || match;
    });
}

/**
 * Reduce common Markdown to readable plain text. Tool descriptions arrive as
 * raw Markdown (headings, bold, links, image tags) which — rendered as-is —
 * dumps the syntax verbatim and balloons the card. This drops the markup and
 * keeps the visible text so it can be safely line-clamped.
 */
export function stripMarkdown(md: string): string {
    if (!md) return '';

    let text = md;
    // fenced code blocks -> keep the inner code text
    text = text.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, '$1');
    // images ![alt](url) -> drop entirely (must run before the link rule)
    text = text.replace(/!\[[^\]]*]\([^)]*\)/g, '');
    // links [text](url) -> text
    text = text.replace(/\[([^\]]*)]\([^)]*\)/g, '$1');
    // headings, blockquotes and list markers at line starts
    text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    text = text.replace(/^\s{0,3}>\s?/gm, '');
    text = text.replace(/^\s*[-*+]\s+/gm, '');
    text = text.replace(/^\s*\d+\.\s+/gm, '');
    // horizontal rules
    text = text.replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, '');
    // bold / italic / strikethrough / inline code
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    text = text.replace(/~~(.*?)~~/g, '$1');
    text = text.replace(/`([^`]*)`/g, '$1');
    // collapse the whitespace the markup left behind
    text = text.replace(/\n{2,}/g, '\n').replace(/[ \t]{2,}/g, ' ');

    return text.trim();
}

/**
 * While Markdown text is streaming a link arrives character by character, so the
 * raw `[label](htt` would flash before it can be rendered. Hide that trailing
 * fragment until the link is complete.
 */
export function trimTrailingPartialLink(text: string): string {
    const open = text.lastIndexOf('[');
    if (open === -1) return text;
    return /^\[[^\]]*]\([^)]*\)/.test(text.slice(open)) ? text : text.slice(0, open);
}

/**
 * Describes a result count without quoting `totalFound` as a number.
 *
 * `totalFound` is OpenSearch's hit total for a `multi_match` that defaults to OR, so it
 * counts records containing ANY query word — "climate data" reports ~296k against a
 * ~392k corpus, because almost every record mentions "data". It is also the sum of two
 * corpora (ours plus Zenodo). Printing it reads as "296,193 relevant datasets", which is
 * badly wrong. It is still a reliable "there are more beyond these" signal, so it decides
 * the wording without ever being shown.
 */
export function describeResultCount(shown: number, retrieved: number, totalFound: number): string {
    if (shown !== retrieved) {
        return `Showing ${shown} of ${retrieved} datasets`;
    }
    if (totalFound > retrieved) {
        return `Showing the ${retrieved} most relevant datasets`;
    }
    return `Found ${shown} dataset${shown !== 1 ? 's' : ''}`;
}

/**
 * Human-readable file size, or null when there is no usable number — callers omit the
 * size entirely rather than printing a misleading "0 B" for an unknown value.
 */
export function formatFileSize(bytes: number | null | undefined): string | null {
    if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
    if (bytes < 1024) return `${bytes} B`;

    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    // One decimal below 10 (2.4 MB), none above it (240 MB) — enough precision to compare
    // small files without a wall of digits on large ones.
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** Pretty-print a JSON payload with 2-space indent; returns the input unchanged when it is not JSON. */
export function prettyJson(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
        return trimmed;
    }
}

/** A dataset's publication date: the full date when the backend has one, otherwise the year. */
export const publicationDateOf = (hit: BackendDataset): string | null =>
    hit.publication_date || hit._source.publicationYear || null;

/** A bare year stays as it is; a full date renders as YYYY.MM.DD. */
export const formatPublicationDate = (dateStr: string): string =>
    /^\d{4}$/.test(dateStr) ? dateStr : new Date(dateStr).toISOString().slice(0, 10).replace(/-/g, '.');
