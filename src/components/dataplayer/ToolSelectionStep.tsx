import {ToolConfig} from '@/types/dataplayerTypes';

// component: textbox to input text to search tool
export function ToolSearchInput({
                                    value, onChange
                                }: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="p-4 border rounded-lg border-eosc-border bg-eosc-card">
            <p className="text-sm font-semibold text-eosc-text mb-2">
                Search for a tool
            </p>
            <input
                type="text"
                placeholder="Search tools..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full p-3 border border-eosc-border rounded-lg focus:ring-2 focus:ring-eosc-light-blue text-eosc-text bg-eosc-card"
            />
        </div>
    );
}

// component: list all found tools
export function ToolResultSelect({
                                     isFilesLoading, results, handleToolSelect
                                 }: {
    isFilesLoading: boolean;
    results: Record<string, ToolConfig>;
    handleToolSelect: (key: string) => Promise<void>;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {Object.entries(results).length === 0 ? (
                    <div className="col-span-full text-center py-8 text-eosc-gray">
                        No tools found.
                    </div>
                ) :
                (Object.entries(results) as [string, ToolConfig][]).map(([key, config]) => (
                    <button
                        key={key}
                        onClick={() => handleToolSelect(key)}
                        disabled={isFilesLoading}
                        className="p-4 sm:p-6 border-2 border-eosc-border rounded-lg hover:border-eosc-light-blue hover:bg-eosc-bg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed bg-eosc-card"
                    >
                        <h3 className="text-base sm:text-lg font-semibold text-eosc-text mb-1 sm:mb-2">{config.name}</h3>
                        <p className="text-xs sm:text-sm text-eosc-gray">{config.description}</p>
                    </button>
                ))}
        </div>
    );
}

interface ToolSelectionStepProps {
    toolSearchText: string;
    setToolSearchText: (text: string) => void;
    isFilesLoading: boolean;
    queryToolResults: Record<string, ToolConfig>;
    handleToolSelect: (key: string) => Promise<void>;
    filesError: string | null;
    selectedToolId: string | null;
}

export const ToolSelectionStep = ({
                                      toolSearchText,
                                      setToolSearchText,
                                      isFilesLoading,
                                      queryToolResults,
                                      handleToolSelect,
                                      filesError,
                                      selectedToolId
                                  }: ToolSelectionStepProps) => {
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-eosc-text mb-2">Select a tool</h2>
                <p className="text-sm sm:text-base text-eosc-gray">Choose the tool you want to use with your dataset</p>
            </div>

            <div className="space-y-6 mb-6">
                <ToolSearchInput
                    value={toolSearchText}
                    onChange={setToolSearchText}
                />
            </div>

            <ToolResultSelect
                isFilesLoading={isFilesLoading}
                results={queryToolResults}
                handleToolSelect={handleToolSelect}
            />

            {filesError && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm sm:text-base text-red-900 break-words">{filesError}</p>
                    <button
                        onClick={() => selectedToolId && handleToolSelect(selectedToolId)}
                        className="mt-2 sm:mt-3 text-xs sm:text-sm text-red-700 underline"
                    >
                        Try again
                    </button>
                </div>
            )}
        </div>
    );
};

