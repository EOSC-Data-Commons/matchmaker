import type {DatasetFile} from "@/types/commons.ts";

/**
 * Recognising the payloads the agent's tools return, so each can be rendered as
 * itself rather than as raw JSON. Anything unrecognised falls back to the raw
 * output view, which is what keeps a newly added backend tool from breaking the UI.
 */

/** How each of the agent's tools is named in the thread and in an exported conversation. */
const TOOL_LABELS: Record<string, string> = {
    search_data: 'Searched datasets',
    search_tools: 'Searched tools',
    get_dataset_files: 'Listed dataset files',
};

/** The reader-facing name of a tool; a tool added on the backend later shows its own name. */
export const toolLabel = (name: string): string => TOOL_LABELS[name] ?? name;

/**
 * Recognises a `get_dataset_files` payload (`{files: [{name, link, …}]}`).
 * Returns null for anything else.
 */
export const parseDatasetFiles = (raw: string): DatasetFile[] | null => {
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const files = (parsed as Record<string, unknown>).files;
        if (!Array.isArray(files)) return null;
        // An empty list is a valid answer ("this dataset has no files"), so it still counts
        // as a files payload — but a non-empty one must actually look like file entries.
        if (files.length > 0) {
            const first = files[0];
            if (!first || typeof first !== 'object' || !('name' in first)) return null;
        }
        return files as DatasetFile[];
    } catch {
        return null;
    }
};
