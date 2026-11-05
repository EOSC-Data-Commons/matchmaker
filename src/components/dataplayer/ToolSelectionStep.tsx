import {ToolConfig} from '@/types/dataplayerTypes';
import {stripMarkdown} from '@/lib/utils';
import useMatomo from '@/hooks/useMatomo';
import {LoaderIcon} from 'lucide-react';

// component: textbox to input text to search tool
export function ToolSearchInput({
                                    value, onChange
                                }: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="p-4 bg-white border border-eosc-border rounded-lg">
            <p className="text-sm font-light text-eosc-text mb-2">Search for a tool</p>
            <input
                type="text"
                placeholder="Search tools..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full font-light p-3 border border-eosc-border rounded-lg focus:ring-2 focus:ring-eosc-light-blue text-eosc-text bg-white"
            />
        </div>
    );
}

const TOOL_SUGGESTIONS = ['jupyter', 'notebook', 'python'];

// component: list all found tools
export function ToolResultSelect({
                                     isToolsLoading, results, handleToolSelect, onPickSuggestion
                                 }: {
    isToolsLoading: boolean;
    results: Record<string, ToolConfig>;
    handleToolSelect: (key: string) => Promise<void>;
    onPickSuggestion: (text: string) => void;
}) {
    const {trackEvent} = useMatomo();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isToolsLoading ? (
                <div className="col-span-full text-center py-8 text-eosc-gray font-light bg-white rounded-lg border border-eosc-border flex items-center justify-center gap-3 min-h-[75px]">
                    <LoaderIcon className="h-5 w-5 text-blue-600 animate-spin shrink-0"/>
                    Finding tools matching your dataset description...
                </div>
            ) : Object.entries(results).length === 0 ? (
                        <div
                            className="col-span-full text-center py-8 px-4 text-eosc-gray font-light bg-white rounded-lg border border-eosc-border flex flex-col items-center justify-center gap-4 min-h-[75px]">
                            <div>
                                <p className="text-eosc-text">No tools found.</p>
                                <p className="text-sm mt-1">Search by tool name, or start with a suggestion:</p>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {TOOL_SUGGESTIONS.map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        onClick={() => onPickSuggestion(suggestion)}
                                        className="px-3 py-1.5 rounded-full text-sm font-light border border-eosc-border bg-eosc-bg text-eosc-text hover:border-eosc-light-blue hover:text-eosc-light-blue transition-colors cursor-pointer"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                ) :
                (Object.entries(results) as [string, ToolConfig][]).map(([key, config], index) => (
                    <button
                        key={key}
                        onClick={() => {
                            // The name as shown on the card and its 1-based place in the list.
                            trackEvent('Data Player', 'tool_selected', config.name || key, index + 1);
                            void handleToolSelect(key);
                        }}
                        disabled={isToolsLoading}
                        className="p-5 bg-white border border-eosc-border flex flex-col items-start rounded-xl hover:bg-gray-50 hover:border-eosc-light-blue transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed h-full w-full overflow-hidden cursor-pointer"
                    >
                        <h3 className="text-base sm:text-lg font-light text-eosc-text mb-2 wrap-break-word w-full">{config.name}</h3>
                        {(() => {
                            const description = stripMarkdown(config.description);
                            return (
                                <p
                                    className="text-sm font-light text-eosc-gray wrap-break-word w-full grow line-clamp-3"
                                    title={description}
                                >
                                    {description}
                                </p>
                            );
                        })()}
                    </button>
                ))}
        </div>
    );
}

interface ToolSelectionStepProps {
    toolSearchText: string;
    setToolSearchText: (text: string) => void;
    isToolsLoading: boolean;
    queryToolResults: Record<string, ToolConfig>;
    handleToolSelect: (key: string) => Promise<void>;
    searchError: string | null;
    selectedToolId: string | null;
}

export const ToolSelectionStep = ({
                                      toolSearchText,
                                      setToolSearchText,
                                      isToolsLoading,
                                      queryToolResults,
                                      handleToolSelect,
                                      searchError,
                                      selectedToolId
                                  }: ToolSelectionStepProps) => {
    return (
        <div className="w-full">
            <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-light text-eosc-text mb-2">Select a tool</h2>
                <p className="text-sm sm:text-base text-eosc-gray font-light">Choose the tool you want to use with your
                    dataset</p>
            </div>

            <div className="space-y-6 mb-6">
                <ToolSearchInput
                    value={toolSearchText}
                    onChange={setToolSearchText}
                />
            </div>

            {searchError && (
                <div className="mb-6 p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm sm:text-base text-red-900 font-light wrap-break-word">{searchError}</p>
                </div>
            )}

            <ToolResultSelect
                isToolsLoading={isToolsLoading}
                results={queryToolResults}
                handleToolSelect={handleToolSelect}
                onPickSuggestion={setToolSearchText}
            />
        </div>
    );
};
