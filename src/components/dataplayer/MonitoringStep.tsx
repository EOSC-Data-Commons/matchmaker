import React from 'react';
import {LoaderIcon, CheckCircleIcon, XCircleIcon} from 'lucide-react';
import {DispatchResult, TaskState, ToolConfig} from '@/types/dataplayerTypes';

interface MonitoringStepProps {
    statusType: TaskState;
    statusMessage: string;
    datasetTitle: string | null;
    selectedToolId: string | null;
    toolConfig: ToolConfig | null;
    taskId: string | null;
    taskResult: DispatchResult | null;
    onStartOver: () => void;
}

export const MonitoringStep = ({
                                   statusType,
                                   statusMessage,
                                   datasetTitle,
                                   selectedToolId,
                                   toolConfig,
                                   taskId,
                                   taskResult,
                                   onStartOver
                               }: MonitoringStepProps) => {

    const getStatusIcon = () => {
        switch (statusType) {
            case "READY":
                return <CheckCircleIcon className="h-8 w-8 text-green-600"/>;
            case "EXCEPTION":
                return <XCircleIcon className="h-8 w-8 text-red-600"/>;
            default:
                return <LoaderIcon className="h-8 w-8 text-eosc-light-blue animate-spin"/>;
        }
    };

    const getStatusColorClass = () => {
        switch (statusType) {
            case "READY":
                return 'text-green-700 bg-green-50 border-green-200';
            case "EXCEPTION":
                return 'text-red-700 bg-red-50 border-red-200';
            default:
                return 'text-eosc-dark-blue bg-eosc-bg border-eosc-border';
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className={`rounded-lg border-2 p-4 sm:p-6 md:p-8 ${getStatusColorClass()}`}>
                <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className="shrink-0">
                        {getStatusIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg sm:text-xl font-semibold mb-2">Tool launching status</h2>
                        <p className="text-base sm:text-lg mb-4 break-words">{statusMessage}</p>

                        {datasetTitle && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-eosc-card rounded border border-eosc-border">
                                <p className="text-xs sm:text-sm font-medium text-eosc-gray mb-1">Dataset:</p>
                                <p className="text-sm sm:text-base text-eosc-text break-words">{datasetTitle}</p>
                            </div>
                        )}

                        {selectedToolId && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-eosc-card rounded border border-eosc-border">
                                <p className="text-xs sm:text-sm font-medium text-eosc-gray mb-1">
                                    Tool:
                                </p>
                                <p className="text-sm sm:text-base text-eosc-text break-words">{toolConfig ? toolConfig.name : "Loading tool config..."}</p>
                                <p className="text-xs sm:text-sm font-medium text-eosc-gray mb-1">VRE:</p>
                                <p className="text-sm sm:text-base text-eosc-text break-words">(placeholder for VRE
                                    entity)</p>
                            </div>
                        )}

                        {taskId && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-eosc-card rounded border border-eosc-border">
                                <p className="text-xs sm:text-sm font-medium text-eosc-gray mb-1">Task ID:</p>
                                <p className="text-xs sm:text-sm text-eosc-text font-mono break-all">{taskId}</p>
                            </div>
                        )}

                        {taskResult && taskResult.url && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-eosc-card rounded border border-eosc-border">
                                <p className="text-xs sm:text-sm font-medium text-eosc-gray mb-2">
                                    Tool in the Virtual Research Environment is Ready!
                                </p>
                                <p className="text-xs sm:text-sm text-eosc-gray mb-3">
                                    Your tool is ready to run your analysis.
                                </p>
                                <button
                                    onClick={() => window.open(taskResult.url, '_blank', 'noopener,noreferrer')}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 transition-colors cursor-pointer"
                                >
                                    Open the tool →
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mt-4 sm:mt-6">
                            {statusType === "EXCEPTION" && (
                                <button
                                    onClick={onStartOver}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-eosc-gray px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-eosc-dark-blue transition-colors cursor-pointer"
                                >
                                    Start Over
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

