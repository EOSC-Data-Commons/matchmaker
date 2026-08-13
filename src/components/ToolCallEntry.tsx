import {useState} from "react";
import {ChevronDown, ChevronRight, FileIcon, Loader2, Search, Wrench} from "lucide-react";
import type {ToolCall} from "../types/chat.ts";
import {prettyJson} from "../lib/utils.ts";
import {SearchResultItem} from "./SearchResultItem.tsx";
import {ToolResultCard} from "./ToolResultCard.tsx";
import {DatasetFilesList} from "./DatasetFilesList.tsx";
import {parseDatasetFiles} from "../lib/toolResults.ts";

interface ToolCallEntryProps {
    toolCall: ToolCall;
    isLoggedIn?: boolean;
}

const META: Record<string, {label: string; Icon: typeof Search}> = {
    search_data: {label: 'Searched datasets', Icon: Search},
    search_tools: {label: 'Searched tools', Icon: Wrench},
    get_dataset_files: {label: 'Listed dataset files', Icon: FileIcon},
};

/**
 * Collapsible entry for a single tool call inside a bot message.
 * Collapsed: a one-line chip with the result count once it arrives. Expanded:
 * the input arguments plus the tool's result, rendered by shape — dataset cards,
 * tool cards, a file list, or raw output for anything we do not recognise.
 */
export const ToolCallEntry = ({toolCall, isLoggedIn = false}: ToolCallEntryProps) => {
    const [open, setOpen] = useState(false);

    const meta = META[toolCall.name] || {label: toolCall.name, Icon: Wrench};
    const Icon = meta.Icon;
    const hits = toolCall.hits;
    const args = prettyJson(toolCall.args);
    const output = toolCall.output ? prettyJson(toolCall.output) : '';
    // `search_data` and `search_tools` both return the search shape, so hits are parsed
    // already; only the remaining raw output can be a file listing.
    const files = toolCall.output ? parseDatasetFiles(toolCall.output) : null;
    const pending = !toolCall.done && !hits && !toolCall.output;

    const count = hits?.length ?? files?.length ?? null;
    const noun = hits ? 'result' : 'file';

    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
                {open ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400"/> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400"/>}
                <Icon className="h-4 w-4 shrink-0 text-blue-600"/>
                <span className="font-medium">{meta.label}</span>
                {count !== null && (
                    <span className="text-gray-400">· {count} {noun}{count !== 1 ? 's' : ''}</span>
                )}
                {pending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400"/>}
            </button>

            {open && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-200 pt-3">
                    {args && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Input</p>
                            <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words text-gray-700">{args}</pre>
                        </div>
                    )}

                    {hits ? (
                        hits.length > 0 ? (
                            <div className="space-y-3">
                                {/* Dispatch per hit rather than per tool, so a result set mixing
                                    datasets and tools still renders each one correctly. */}
                                {hits.map((hit, idx) => (
                                    hit._source?.resourceType === 'tool'
                                        ? <ToolResultCard key={`${toolCall.id}-${idx}`} hit={hit}/>
                                        : <SearchResultItem key={`${toolCall.id}-${idx}`} hit={hit} isLoggedIn={isLoggedIn}/>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500">No results.</p>
                        )
                    ) : files ? (
                        <DatasetFilesList files={files}/>
                    ) : output ? (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Output</p>
                            <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words text-gray-700">{output}</pre>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};
