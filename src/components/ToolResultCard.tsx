import {ExternalLinkIcon, TagIcon, Wrench} from "lucide-react";
import type {BackendDataset} from "../types/commons.ts";
import {stripHtml} from "../lib/utils";

interface ToolResultCardProps {
    hit: BackendDataset;
}

/**
 * A software tool from the tool registry (the `search_tools` tool).
 *
 * Deliberately not a `SearchResultItem`: a tool has no DOI, authors, publication date
 * or deposited files, so that card's citation export, provenance logos and Dataplayer
 * button would all be dead controls. What a tool does have is the file formats it reads
 * and writes, which is the part that matters when matching a tool to a dataset.
 *
 * No relevance badge either — the registry returns results already ordered but without
 * a score, so the backend derives `_score` from the rank (20, 19, 18…). Rendering that
 * as a percentage would be meaningless.
 */
export const ToolResultCard = ({hit}: ToolResultCardProps) => {
    const url = hit.dataset_url || hit._source.url || null;
    const description = stripHtml(hit.description || '');
    const formats = hit.fileExtensions ?? [];

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-2 mb-2">
                <Wrench className="h-4 w-4 shrink-0 text-blue-600 mt-0.5"/>
                <h4 className="text-base font-semibold text-gray-900 min-w-0 break-words">
                    {hit.title || 'Untitled tool'}
                </h4>
            </div>

            {description && (
                <p className="text-sm text-gray-700 leading-relaxed mb-3 line-clamp-4">{description}</p>
            )}

            {formats.length > 0 && (
                <div className="flex items-start gap-2 mb-3">
                    <TagIcon className="h-4 w-4 shrink-0 text-gray-400 mt-0.5"/>
                    <div className="flex flex-wrap gap-1.5">
                        {formats.map(format => (
                            <span
                                key={format}
                                className="px-2 py-0.5 rounded bg-gray-100 text-xs font-medium text-gray-600"
                            >
                                {format}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {url && (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    <ExternalLinkIcon className="h-4 w-4"/>
                    Open tool
                </a>
            )}
        </div>
    );
};
