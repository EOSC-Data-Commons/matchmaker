import {FileMeta, ToolConfig, TypedValue} from '@/types/dataplayerTypes';

interface slotsMappingAndFilesSetProps {
    selectedToolId: string | null;
    toolConfig: ToolConfig | null;
    files: FileMeta[];
    filesMapping: Record<string, [FileMeta, string]>;
    valueParametersMapping: Record<string, TypedValue>;
    addToFilesSet: (slotName: string, fileMeta: FileMeta, renameTo: string) => void;
    removeFromFilesSet: (name: string) => void;
    handleValueSlotSet: (slotName: string, value: TypedValue) => void;
    allParametersMapped: boolean;
    onReselectTool: () => void;
    onSubmit: () => void;
}

export const SlotsMappingAndFilesSetStep = ({
                                    selectedToolId,
                                    toolConfig,
                                    files,
                                    filesMapping,
                                    valueParametersMapping,
                                    addToFilesSet,
                                    removeFromFilesSet,
                                    handleValueSlotSet,
                                    allParametersMapped,
                                    onReselectTool,
                                    onSubmit
                                }: slotsMappingAndFilesSetProps) => {
    console.warn(selectedToolId);
    console.warn(toolConfig);
    
    if (!selectedToolId) return null;

    const addFile = () => {
        const slotIndex = Object.keys(filesMapping).length + 1;
        const name = `slot-${slotIndex}`;

        addToFilesSet(name, {
            dataPath: "",
            filename: "",
            size: "",
            hash: null,
            hash_type: "",
            isDir: false,
            mimetype: "",
        }, "");
    };

    return (
        <div className="w-full font-light">
            <div className="mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-light text-eosc-text mb-2">Map Input Files & Parameters</h2>
                <p className="text-sm sm:text-base text-eosc-gray font-light">
                    Setup required input parameters for running tool. Assign files to a tool file input. Each file slot
                    must have exactly one file.
                </p>

                <div className="mt-4 p-4 sm:p-5 bg-eosc-bg rounded-lg border border-eosc-border flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-medium text-eosc-gray uppercase tracking-wider mb-1">
                                Selected Tool
                            </p>
                            <p className="text-sm sm:text-base text-eosc-text font-light wrap-break-word">
                                {toolConfig ? toolConfig.name : "Loading tool config..."}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-eosc-gray uppercase tracking-wider mb-1">
                                Execution Environment
                            </p>
                            <p className="text-sm sm:text-base text-eosc-text font-light wrap-break-word">
                                VRE Instance (System Default)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Required Parameters Info */}
            <div className="mb-6 p-4 sm:p-5 bg-white rounded-lg border border-eosc-border">
                <p className="text-xs font-medium text-eosc-gray uppercase tracking-wider mb-3">Required Parameters
                    Tracking</p>
                <div className="flex flex-wrap gap-2">
                    {toolConfig ? toolConfig.slots.map(param => {
                        const isMapped = Object.keys(valueParametersMapping).includes(param.name);
                        return (
                            <span
                                key={param.name}
                                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-light border ${
                                    isMapped
                                        ? 'bg-blue-50 text-eosc-light-blue border-blue-200'
                                        : 'bg-eosc-bg text-eosc-gray border-eosc-border'
                                }`}
                            >
                                {param.name} <span
                                className="opacity-75 font-light">({param.typ})</span> {isMapped ? '✓' : '⚠'}
                            </span>
                        );
                    }) : "Loading tool config"}
                </div>
            </div>

            <div className="bg-white rounded-lg border border-eosc-border overflow-hidden mb-8">
                <div className="overflow-x-auto">
                    {toolConfig ? (<table className="min-w-full divide-y divide-eosc-border table-fixed">
                            <thead className="bg-eosc-bg">
                            <tr>
                                <th className="w-1/4 px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-eosc-gray uppercase tracking-wider">
                                    Parameter
                                </th>
                                <th className="w-1/4 px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-eosc-gray uppercase tracking-wider">
                                    Data Type
                                </th>
                                <th className="w-1/2 px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-eosc-gray uppercase tracking-wider">
                                    Value Assignment
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-eosc-border">
                            {toolConfig.slots.map((param) => (
                                <tr className="hover:bg-gray-50 transition-colors" key={param.name}>
                                    <td className="px-4 sm:px-6 py-4 text-sm font-light text-eosc-text wrap-break-word">
                                        {param.name}
                                    </td>
                                    <td className="px-4 sm:px-6 py-4 text-sm text-eosc-gray wrap-break-word">
                                    <span
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-light bg-eosc-bg border border-eosc-border text-eosc-text">
                                        {param.typ}
                                    </span>
                                    </td>
                                    <td className="px-4 sm:px-6 py-4 p-2">
                                        {param.typ === "File" && (
                                            <select
                                                onChange={(e) => {
                                                    const index = Number(e.target.value);
                                                    const selectedFile = files[index];
                                                    handleValueSlotSet(param.name, selectedFile);
                                                }}
                                                value={files.findIndex(f => f === valueParametersMapping[param.name]) ?? ""}
                                                className="block w-full max-w-full px-3 py-2 text-sm border border-eosc-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-eosc-light-blue focus:border-eosc-light-blue bg-white text-eosc-text wrap-break-word whitespace-normal"
                                            >
                                                <option key="none" value="">-- Select a file to assign --</option>
                                                {files.map((file, fileIndex) => (
                                                    <option key={fileIndex} value={fileIndex}>
                                                        {file.filename}
                                                    </option>
                                                ))}
                                            </select>
                                        )}

                                        {(param.typ === "Number") && (
                                            <input
                                                type="number"
                                                value={(valueParametersMapping[param.name] as number) ?? ""}
                                                onChange={(e) => handleValueSlotSet(param.name, Number(e.target.value))}
                                                placeholder="Enter number..."
                                                className="block w-full max-w-md px-3 py-2 font-light text-sm border border-eosc-border rounded-md focus:outline-none focus:ring-2 focus:ring-eosc-light-blue focus:border-eosc-light-blue bg-white text-eosc-text"
                                            />
                                        )}

                                        {(param.typ === "Text") && (
                                            <input
                                                type="text"
                                                value={(valueParametersMapping[param.name] as string) ?? ""}
                                                onChange={(e) => handleValueSlotSet(param.name, e.target.value)}
                                                placeholder="Enter text..."
                                                className="block w-full max-w-md px-3 py-2 font-light text-sm border border-eosc-border rounded-md focus:outline-none focus:ring-2 focus:ring-eosc-light-blue focus:border-eosc-light-blue bg-white text-eosc-text"
                                            />
                                        )}

                                        {param.typ === "Flag" && (
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(valueParametersMapping[param.name] as boolean) || false}
                                                    onChange={(e) => handleValueSlotSet(param.name, e.target.checked)}
                                                    className="form-checkbox h-5 w-5 text-eosc-light-blue border-eosc-border rounded focus:ring-eosc-light-blue transition duration-150 ease-in-out"
                                                />
                                                <span
                                                    className="ml-2 text-sm text-eosc-text">{valueParametersMapping[param.name] ? 'Enabled' : 'Disabled'}</span>
                                            </label>
                                        )}

                                        {param.typ === "Unknown" && (
                                            <span className="text-gray-400 text-sm italic">Unsupported parameter type</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>) :
                        <div className="p-8 text-center text-eosc-gray">No parameters available for this tool.</div>}
                </div>
            </div>

            {/* For filesOnly and SlotsAndFiles tool, require widget for getting files. */}
            {( toolConfig && ( toolConfig.typ == "FilesOnly" || toolConfig.typ == "FilesAndSlots")) && (
                <div className="bg-white rounded-lg border border-eosc-border overflow-hidden mb-8">
                    <div className="p-4 space-y-4">

                        {/* Header */}
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-eosc-text">
                                Input Files
                            </span>

                            <button
                                onClick={addFile}
                                className=""
                            >
                                + Add File
                            </button>
                        </div>

                        {/* Rows */}
                        <div className="space-y-3">
                            {Object.entries(filesMapping).map(([key, item]) => (
                                <div
                                    key={key}
                                    className="flex flex-col sm:flex-row gap-2"
                                >
                                    {/* Select file */}
                                    <select
                                        value={item[0].dataPath ?? ""}
                                        onChange={(e) => {
                                            const selected = files.find(
                                                f => f.dataPath === e.target.value
                                            );
                                            if (selected) {
                                                addToFilesSet(key, selected, selected.filename);
                                            }
                                        }}
                                        className="block w-full sm:w-1/2 px-3 py-2 text-sm border border-eosc-border rounded-md bg-white"
                                    >
                                        <option value="">-- Select file --</option>
                                        {files.map((file) => (
                                            <option
                                                key={file.dataPath}
                                                value={file.filename}
                                            >
                                                {file.filename}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Rename */}
                                    <input
                                        type="text"
                                        defaultValue={item[0].filename ?? ""}
                                        onChange={(e) =>
                                            addToFilesSet(key, {
                                                ...item[0],
                                            }, e.target.value)
                                        }
                                        placeholder="Rename file..."
                                        className="block w-full sm:w-1/2 px-3 py-2 text-sm border border-eosc-border rounded-md"
                                    />

                                    {/* Remove */}
                                    <button
                                        onClick={() => removeFromFilesSet(key)}
                                        className="text-red-500 text-sm px-2 py-1 hover:underline"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>

                        {Object.keys(filesMapping).length === 0 && (
                            <div className="text-sm text-eosc-gray text-center">
                                No files added.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div
                className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-eosc-border">
                <button
                    onClick={onReselectTool}
                    className="text-sm font-light text-eosc-gray hover:text-eosc-light-blue flex items-center transition-colors px-4 py-2 rounded-md hover:bg-eosc-bg cursor-pointer"
                >
                    <span className="mr-2">←</span> Reselect Tool
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    {!allParametersMapped && (
                        <p className="text-sm text-orange-600 bg-orange-50 px-3 py-1.5 rounded-md border border-orange-200 w-full sm:w-auto text-center font-light">
                            Map all required parameters to proceed
                        </p>
                    )}
                    <button
                        onClick={onSubmit}
                        disabled={!allParametersMapped}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-white border border-eosc-border px-6 py-2.5 text-sm font-light text-eosc-text hover:bg-gray-50 hover:border-eosc-light-blue focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                    >
                        Submit to VRE
                    </button>
                </div>
            </div>
        </div>
    );
};
