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
                return 'text-eosc-text bg-white border-eosc-border';
        }
    };

    return (
        <div className="w-full font-light">
            <div className={`rounded-xl border p-5 sm:p-8 ${getStatusColorClass()}`}>
                <div
                    className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                    <div
                        className="shrink-0 flex items-center justify-center p-2 bg-white border border-eosc-border rounded-full">
                        {getStatusIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl font-light mb-1">Tool Launch Status</h2>
                        <p className="text-sm sm:text-base opacity-90 break-words font-light">{statusMessage}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {datasetTitle && (
                        <div className="p-4 bg-white rounded-lg border border-eosc-border flex flex-col justify-center">
                            <p className="text-xs font-medium uppercase tracking-wider text-eosc-gray mb-1">Dataset</p>
                            <p className="text-sm sm:text-base font-light break-words whitespace-normal text-eosc-text">{datasetTitle}</p>
                        </div>
                    )}

                    {selectedToolId && (
                        <div className="p-4 bg-white rounded-lg border border-eosc-border flex flex-col justify-center">
                            <p className="text-xs font-medium uppercase tracking-wider text-eosc-gray mb-1">
                                Tool Configuration
                            </p>
                            <p className="text-sm sm:text-base font-light text-eosc-text break-words mb-2">
                                {toolConfig ? toolConfig.name : "Loading tool config..."}
                            </p>
                            <p className="text-xs font-medium uppercase tracking-wider text-eosc-gray mb-1">Environment</p>
                            <p className="text-sm font-light text-eosc-text break-words">(placeholder for VRE
                                entity)</p>
                        </div>
                    )}
                </div>

                {taskId && (
                    <div
                        className="mt-4 p-4 bg-white rounded-lg border border-eosc-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-eosc-gray mb-1">Task ID</p>
                        </div>
                        <p className="text-xs sm:text-sm font-mono bg-gray-50 px-3 py-1.5 rounded border border-eosc-border break-all w-full sm:w-auto text-left sm:text-right text-eosc-text">
                            {taskId}
                        </p>
                    </div>
                )}

                {taskResult && taskResult.url && (
                    <div
                        className="mt-6 p-5 bg-white rounded-lg border border-green-200 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <p className="text-sm sm:text-base font-medium text-green-700 mb-1">
                                Ready for Analysis!
                            </p>
                            <p className="text-sm font-light text-gray-600">
                                Your tool has been successfully provisioned in the Virtual Research Environment.
                            </p>
                        </div>
                        <button
                            onClick={() => window.open(taskResult.url, '_blank', 'noopener,noreferrer')}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-white border border-eosc-border px-6 py-2.5 text-sm font-light text-eosc-text hover:bg-gray-50 hover:border-eosc-light-blue transition-colors whitespace-nowrap cursor-pointer"
                        >
                            Open the tool →
                        </button>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-6">
                    {statusType === "EXCEPTION" && (
                        <button
                            onClick={onStartOver}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-white border border-eosc-border px-6 py-2.5 text-sm font-light text-eosc-text hover:bg-gray-50 hover:border-eosc-light-blue transition-colors cursor-pointer"
                        >
                            Start Over
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
