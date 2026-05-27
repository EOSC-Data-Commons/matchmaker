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
                return 'text-green-700 bg-green-50 border-green-200 shadow-sm';
            case "EXCEPTION":
                return 'text-red-700 bg-red-50 border-red-200 shadow-sm';
            default:
                return 'text-eosc-dark-blue bg-eosc-bg border-eosc-border shadow-sm';
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            <div className={`rounded-lg border p-5 sm:p-8 ${getStatusColorClass()}`}>
                <div
                    className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                    <div className="shrink-0 flex items-center justify-center p-2 bg-white rounded-full shadow-sm">
                        {getStatusIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl font-bold mb-1">Tool Launch Status</h2>
                        <p className="text-sm sm:text-base opacity-90 break-words">{statusMessage}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {datasetTitle && (
                        <div className="p-4 bg-white rounded-lg border shadow-sm flex flex-col justify-center">
                            <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Dataset</p>
                            <p className="text-sm sm:text-base font-medium break-words whitespace-normal">{datasetTitle}</p>
                        </div>
                    )}

                    {selectedToolId && (
                        <div className="p-4 bg-white rounded-lg border shadow-sm flex flex-col justify-center">
                            <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">
                                Tool Configuration
                            </p>
                            <p className="text-sm sm:text-base font-medium break-words mb-2">
                                {toolConfig ? toolConfig.name : "Loading tool config..."}
                            </p>
                            <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Environment</p>
                            <p className="text-sm break-words">(placeholder for VRE entity)</p>
                        </div>
                    )}
                </div>

                {taskId && (
                    <div
                        className="mt-4 p-4 bg-white rounded-lg border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Task ID</p>
                        </div>
                        <p className="text-xs sm:text-sm font-mono bg-gray-50 px-3 py-1.5 rounded border break-all w-full sm:w-auto text-left sm:text-right">
                            {taskId}
                        </p>
                    </div>
                )}

                {taskResult && taskResult.url && (
                    <div
                        className="mt-6 p-5 bg-white rounded-lg border border-green-200 shadow-sm text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <p className="text-sm sm:text-base font-bold text-green-700 mb-1">
                                Ready for Analysis!
                            </p>
                            <p className="text-sm text-gray-600">
                                Your tool has been successfully provisioned in the Virtual Research Environment.
                            </p>
                        </div>
                        <button
                            onClick={() => window.open(taskResult.url, '_blank', 'noopener,noreferrer')}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-eosc-light-blue px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-eosc-dark-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-eosc-light-blue transition-all whitespace-nowrap"
                        >
                            Open the tool →
                        </button>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-6">
                    {statusType === "EXCEPTION" && (
                        <button
                            onClick={onStartOver}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-white border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-eosc-light-blue transition-all"
                        >
                            Start Over
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
