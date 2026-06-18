import {ToolConfig} from '@/types/dataplayerTypes';

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

// component: list all found tools
export function ToolResultSelect({
                                     isFilesLoading, results, handleToolSelect
                                 }: {
    isFilesLoading: boolean;
    results: Record<string, ToolConfig>;
    handleToolSelect: (key: string) => Promise<void>;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(results).length === 0 ? (
                    <div
                        className="col-span-full text-center py-8 text-eosc-gray font-light bg-white rounded-lg border border-eosc-border flex items-center justify-center min-h-[75px]">
                        No tools found.
                    </div>
                ) :
                (Object.entries(results) as [string, ToolConfig][]).map(([key, config]) => (
                    <button
                        key={key}
                        onClick={() => handleToolSelect(key)}
                        disabled={isFilesLoading}
                        className="p-5 bg-white border border-eosc-border flex flex-col items-start rounded-xl hover:bg-gray-50 hover:border-eosc-light-blue transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed h-full w-full overflow-hidden cursor-pointer"
                    >
                        <h3 className="text-base sm:text-lg font-light text-eosc-text mb-2 wrap-break-word w-full">{config.name}</h3>
                        <p className="text-sm font-light text-eosc-gray wrap-break-word w-full grow">{config.description}</p>
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

            <ToolResultSelect
                isFilesLoading={isFilesLoading}
                results={queryToolResults}
                handleToolSelect={handleToolSelect}
            />

            {filesError && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm sm:text-base text-red-900 font-light wrap-break-word">{filesError}</p>
                    <button
                        onClick={() => selectedToolId && handleToolSelect(selectedToolId)}
                        className="mt-2 sm:mt-3 text-xs sm:text-sm text-red-700 underline font-light"
                    >
                        Try again
                    </button>
                </div>
            )}
        </div>
    );
};
