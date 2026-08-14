import type {Message} from "@/types/chat.ts";
import type {BackendDataset} from "@/types/commons.ts";

/**
 * Resolves a Markdown link in an assistant answer back to the dataset it cites.
 *
 * The backend asks the model to cite a dataset as a plain link to the hit's
 * `dataset_url`, with no custom syntax, so a link that matches nothing is still
 * a working external link.
 */

/**
 * Normalizes a dataset URL for comparison: the model occasionally rewrites a URL
 * slightly while copying it. Lower-cases the whole URL (DOIs are case-insensitive),
 * drops the scheme, `www.`, a trailing slash, and treats dx.doi.org as doi.org.
 */
export const normalizeDatasetUrl = (url: string): string => {
    const trimmed = url.trim().toLowerCase();
    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.replace(/^www\./, '').replace(/^dx\.doi\.org$/, 'doi.org');
        return `${host}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
    } catch {
        return trimmed.replace(/\/+$/, '');
    }
};

/**
 * Maps every dataset URL seen in the thread's search tool results to its hit, so
 * a Markdown link in the answer can be resolved to the dataset it cites. Later
 * results win on collision.
 */
export const buildDatasetUrlMap = (messages: Message[]): Map<string, BackendDataset> => {
    const map = new Map<string, BackendDataset>();
    for (const message of messages) {
        for (const block of message.blocks ?? []) {
            if (block.kind !== 'tool') continue;
            for (const hit of block.toolCall.hits ?? []) {
                if (hit?.dataset_url) map.set(normalizeDatasetUrl(hit.dataset_url), hit);
            }
        }
    }
    return map;
};

export const lookupDataset = (map: Map<string, BackendDataset>, href: string): BackendDataset | null =>
    map.get(normalizeDatasetUrl(href)) ?? null;
