import React from 'react';
import {FileMeta, ToolConfig, TypedValue} from '@/types/dataplayerTypes';

interface FileMappingStepProps {
    selectedToolId: string | null;
    toolConfig: ToolConfig | null;
    files: FileMeta[];
    fileParametersMapping: Record<string, number>;
    valueParametersMapping: Record<string, TypedValue>;
    handleFileSlotSet: (slotName: string, fileIndex: number) => void;
    handleValueSlotSet: (slotName: string, value: TypedValue) => void;
    allParametersMapped: boolean;
    onReselectTool: () => void;
    onSubmit: () => void;
}

export const FileMappingStep = ({
                                    selectedToolId,
                                    toolConfig,
                                    files,
                                    fileParametersMapping,
                                    valueParametersMapping,
                                    handleFileSlotSet,
                                    handleValueSlotSet,
                                    allParametersMapped,
                                    onReselectTool,
                                    onSubmit
                                }: FileMappingStepProps) => {
    if (!selectedToolId) return null;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-eosc-text mb-2">Map input files and set input
                    parameters</h2>
                <p className="text-sm sm:text-base text-eosc-gray">
                    Setup required input parameters for running tool.
                    Assign files to a tool file input, and each file slot must have exactly one file.
                </p>

                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-eosc-bg rounded-lg border border-eosc-border">
                    <p className="text-xs sm:text-sm font-medium text-eosc-gray mb-1">
                        Selected tool:
                    </p>
                    <p className="text-sm sm:text-base text-eosc-text font-semibold break-words">
                        {toolConfig ? toolConfig.name : "Loading tool config..."}
                    </p>
                    <p className="text-xs sm:text-sm font-medium text-eosc-gray mb-1">
                        Select VRE to run tool:
                    </p>
                    <p className="text-sm sm:text-base text-eosc-text font-semibold break-words">
                        (placeholder) this is for different entities of VRE (e.g. galaxy.eu / galaxy.ch if there are
                        more than one)
                    </p>
                </div>
            </div>

            {/* Required Parameters Info */}
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-eosc-card rounded-lg border border-eosc-border">
                <p className="text-xs sm:text-sm font-medium text-eosc-gray mb-2">Required Parameters:</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {toolConfig ? toolConfig.slots.map(param => {
                        const isMapped = Object.keys(fileParametersMapping).includes(param.name) || Object.keys(valueParametersMapping).includes(param.name);
                        return (
                            <span
                                key={param.name}
                                className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                                    isMapped
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                }`}
                            >
                                {param.name} ({param.typ}) {isMapped ? '✓' : '⚠'}
                            </span>
                        );
                    }) : "Loading tool config"}
                </div>
            </div>

            <div className="hidden md:block bg-eosc-card rounded-lg border border-eosc-border overflow-hidden">
                <div className="overflow-x-auto">
                    {toolConfig ? (<table className="min-w-full divide-y divide-eosc-border">
                        <thead className="bg-eosc-bg">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-eosc-gray uppercase tracking-wider">
                                Parameter
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-eosc-gray uppercase tracking-wider">
                                Data Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-eosc-gray uppercase tracking-wider">
                                Value
                            </th>
                        </tr>
                        </thead>
                        <tbody className="bg-eosc-card divide-y divide-eosc-border">
                        {toolConfig.slots.map((param) => (
                            <tr className="hover:bg-eosc-bg" key={param.name}>
                                <td className="px-6 py-4 text-sm text-eosc-text break-words">
                                    {param.name}
                                </td>
                                <td className="px-6 py-4 text-sm text-eosc-text break-words">
                                    {param.typ}
                                </td>
                                <td className="px-6 py-4">
                                    {param.typ === "File" && (
                                        <select
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "") {
                                                    // Let the parent component know we're unsetting the mapping
                                                    handleFileSlotSet(param.name, -1);
                                                } else {
                                                    handleFileSlotSet(param.name, Number(val));
                                                }
                                            }}
                                            value={fileParametersMapping[param.name] !== undefined ? fileParametersMapping[param.name] : ""}
                                            className="block w-full px-3 py-2 text-sm border border-eosc-border rounded-md shadow-sm focus:outline-none focus:ring-eosc-light-blue focus:border-eosc-light-blue bg-eosc-card text-eosc-text"
                                        >
                                            <option key="none" value="">--select to set parameter--</option>
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
                                            className="block w-full px-3 py-2 text-sm border border-eosc-border rounded-md shadow-sm focus:outline-none focus:ring-eosc-light-blue focus:border-eosc-light-blue bg-eosc-card text-eosc-text"
                                        />
                                    )}

                                    {(param.typ === "Text") && (
                                        <input
                                            type="text"
                                            value={(valueParametersMapping[param.name] as string) ?? ""}
                                            onChange={(e) => handleValueSlotSet(param.name, e.target.value)}
                                            className="block w-full px-3 py-2 text-sm border border-eosc-border rounded-md shadow-sm focus:outline-none focus:ring-eosc-light-blue focus:border-eosc-light-blue bg-eosc-card text-eosc-text"
                                        />
                                    )}

                                    {param.typ === "Flag" && (
                                        <input
                                            type="checkbox"
                                            checked={(valueParametersMapping[param.name] as boolean) || false}
                                            onChange={(e) => handleValueSlotSet(param.name, e.target.checked)}
                                            className="h-4 w-4 text-eosc-light-blue border-eosc-border rounded"
                                        />
                                    )}

                                    {param.typ === "Unknown" && (
                                        <span className="text-gray-400 text-sm">Unsupported type</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>) : <div className="p-4 text-eosc-gray"> "zero parameters" </div>}
                </div>
            </div>

            {/* Action Buttons */}
            <div
                className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <button
                    onClick={onReselectTool}
                    className="text-sm sm:text-base text-eosc-light-blue hover:text-eosc-dark-blue font-medium text-center sm:text-left"
                >
                    ← Reselect tool
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                    {!allParametersMapped && (
                        <p className="text-xs sm:text-sm text-yellow-700 text-center sm:text-right">
                            Map all required parameters to proceed
                        </p>
                    )}
                    <button
                        onClick={onSubmit}
                        disabled={!allParametersMapped}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-medium text-white shadow-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        Submit to VRE
                    </button>
                </div>
            </div>
        </div>
    );
};
