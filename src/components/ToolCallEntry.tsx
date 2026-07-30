import {useState} from "react";
import {ChevronDown, ChevronRight, Loader2, Search, Wrench} from "lucide-react";
import type {ToolCall} from "../types/chat.ts";
import {prettyJson} from "../lib/utils.ts";
import {SearchResultItem} from "./SearchResultItem.tsx";

interface ToolCallEntryProps {
    toolCall: ToolCall;
    isLoggedIn?: boolean;
}

const META: Record<string, {label: string; Icon: typeof Search}> = {
    search_data: {label: 'Searched datasets', Icon: Search},
};

/**
 * Collapsible entry for a single tool call inside a bot message.
 * Collapsed: a one-line chip with the result count once it arrives. Expanded:
 * the input arguments plus either dataset cards (search results) or the raw output.
 */
export const ToolCallEntry = ({toolCall, isLoggedIn = false}: ToolCallEntryProps) => {
    const [open, setOpen] = useState(false);

    const meta = META[toolCall.name] || {label: toolCall.name, Icon: Wrench};
    const Icon = meta.Icon;
    const hits = toolCall.hits;
    const args = prettyJson(toolCall.args);
    const output = toolCall.output ? prettyJson(toolCall.output) : '';
    const pending = !toolCall.done && !hits && !toolCall.output;

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
                {hits && (
                    <span className="text-gray-400">· {hits.length} result{hits.length !== 1 ? 's' : ''}</span>
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
                                {hits.map((hit, idx) => (
                                    <SearchResultItem
                                        key={`${toolCall.id}-${idx}`}
                                        hit={hit}
                                        isLoggedIn={isLoggedIn}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500">No results.</p>
                        )
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
