import {useState} from 'react';
import {useSearchParams, useNavigate} from 'react-router';
import {Footer} from '../components/Footer';
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import eoscLogo from '@/assets/logo-eosc-data-commons.svg';
import {DispatchResult, FileMeta, TaskState, TaskStatus, TypedValue} from '@/types/dataplayerTypes';
import {fetchFilesMetaByDatasetHandle} from '@/lib/coordinatorApi';
import {DataplayInput} from '@/components/DataplayInput';

import {
    useTaskLauncher,
    areAllParametersMapped,
    useDataset,
    useFilesToQueryTool,
    useSearchTextToQueryTool,
    useSelectedToolId,
    buildSlotToFileMapping
} from '@/hooks/useDataplayerHooks';

import {ToolSelectionStep} from '@/components/dataplayer/ToolSelectionStep';
import {FileMappingStep} from '@/components/dataplayer/FileMappingStep';
import {MonitoringStep} from '@/components/dataplayer/MonitoringStep';
import {FilesList} from '@/components/dataplayer/FilesList';

export interface TaskStatusResponse {
    status: TaskStatus;
    result?: DispatchResult;
    error?: string;
}

export type StepType = 'select-analysis' | 'map-files' | 'submitting' | 'monitoring';

export const DataplayerPage = () => {
    const [searchParams] = useSearchParams();

    const datasetTitle = searchParams.get('title');
    const datasetHandle = searchParams.get('datasetId');
    const navigate = useNavigate();

    // Step management
    const [currentStep, setCurrentStep] = useState<StepType>('select-analysis');
    // tool uuid
    const [selectedToolId, setSelectedToolId] = useState<string>(null);

    // File management
    const [fileParametersMapping, setFileParametersMapping] = useState<Record<string, number>>({});
    const [valueParametersMapping, setValueParametersMapping] = useState<Record<string, TypedValue>>({});
    const [filesError, setFilesError] = useState<string | null>(null);

    const {isFilesLoading, files, error, resetDataset} = useDataset(datasetHandle);
    const [isAdding, setIsAdding] = useState(false);
    const [fileGroups, setFileGroups] = useState<FileMeta[][]>([]);


    // Submission tracking
    const [statusMessage, setStatusMessage] = useState('');
    const [statusType, setStatusType] = useState<TaskState>('PENDING');

    const [toolSearchText, setToolSearchText] = useState("");

    const {queryToolResults: toolMatchResults} = useFilesToQueryTool(files);
    const {debouncedSearch, queryToolResults: toolSearchResults} = useSearchTextToQueryTool(toolSearchText);

    // if user start type text to search, give the search result
    // otherwise, output the tool match result.
    const queryToolResults =
        debouncedSearch.trim().length >= 2
            ? toolSearchResults
            : toolMatchResults;

    const {toolConfig} = useSelectedToolId(selectedToolId);

    // Handle input slot mapping change
    const handleFileSlotSet = (slotName: string, fileIndex: number) => {
        setFileParametersMapping(prev => {
            const newMapping = {...prev};

            for (const key in newMapping) {
                if (newMapping[key] === fileIndex) {
                    delete newMapping[key];
                }
            }

            if (slotName === "none") {
                return newMapping;
            }

            newMapping[slotName] = fileIndex;

            return newMapping;
        });
    };

    const handleAddGroup = async (datasetHandle: string) => {
        try {
            setIsAdding(true);

            const newFiles = await fetchFilesMetaByDatasetHandle(datasetHandle);

            setFileGroups((prev) => [...prev, newFiles]);
        } catch (err) {
            console.error("Failed to fetch files", err);
        } finally {
            setIsAdding(false);
        }
    };

    const handleValueSlotSet = (slotName: string, value: TypedValue) => {
        setValueParametersMapping(prev => {
            const newMapping = {...prev};

            // this ensure the "required parameters" block refresh
            if (value === "" || value === null) {
                delete newMapping[slotName];
                return newMapping;
            }

            newMapping[slotName] = value;
            return newMapping;
        });
    };

    // Handle tool selection
    const handleToolSelect = async (tool_id: string) => {
        if (!tool_id) return;

        setSelectedToolId(tool_id);
        setFilesError(null);

        try {
            setCurrentStep('map-files');
        } catch (error) {
            console.error('Error fetching files:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setFilesError(`Failed to load files: ${errorMessage}`);
        }
    };

    const {taskId, taskResult, launch, resetTask} = useTaskLauncher();
    const handleSubmit = async () => {
        if (!selectedToolId) return;

        try {
            setCurrentStep("submitting");
            setStatusMessage("Preparing Virtual Research Environment metadata...");
            setStatusType("PENDING");

            console.log("selected tool id:" + selectedToolId);
            const slotToFileMapping = buildSlotToFileMapping(fileParametersMapping, files);
            const slotToValueMapping = valueParametersMapping;

            // console.warn(slotToValueMapping);
            // console.warn(slotToFileMapping);

            await launch(selectedToolId, datasetHandle, slotToValueMapping, slotToFileMapping, {
                onState: (data) => {
                    setStatusMessage(data.message);
                    setStatusType(data.state);
                    // console.warn(data.state);
                },

                onSuccess: () => {
                    setCurrentStep("monitoring");
                    setStatusMessage("Virtual Research Environment task completed!");
                },

                onError: (err) => {
                    console.error(err);
                    setStatusMessage("Failed to fetch task result");
                    setCurrentStep("map-files");
                    setStatusType("EXCEPTION");
                },
            });
        } catch (err) {
            console.error(err);
            setStatusMessage(err instanceof Error ? err.message : "Unknown error");
            setStatusType("EXCEPTION");
            setCurrentStep("map-files");
        }
    };

    const handleStartOver = () => {
        setCurrentStep('select-analysis');
        setSelectedToolId(null);
        resetDataset();
        setFileParametersMapping({});
        setValueParametersMapping({});
        resetTask();
    };

    return (
        <div className="min-h-screen flex flex-col bg-eosc-bg">
            <header className="border-b border-eosc-border bg-white">
                <div className="container mx-auto px-4 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer"
                             onClick={() => navigate('/')}>
                            <img src={dataCommonsIconBlue} alt="Data Commons" className="h-8 w-8 sm:h-10 sm:w-10"/>
                            <div className="flex flex-col space-y-0.5 sm:space-y-1">
                                <img
                                    src={eoscLogo}
                                    alt="EOSC Data Commons"
                                    className="h-6 sm:h-8 w-auto"
                                />
                                <p className="text-xs sm:text-sm text-eosc-gray">Playing with data...!!!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto p-4">
                {datasetTitle && (
                    <div className="mt-4 p-3 sm:p-4 bg-eosc-card rounded-lg border border-eosc-border">
                        <p className="text-xs sm:text-sm font-medium text-eosc-gray">Dataset:</p>
                        <p className="text-sm sm:text-base text-eosc-text break-words">{datasetTitle}</p>
                    </div>
                )}
                <div className="mt-4 sm:mt-6">
                    <button
                        onClick={() => navigate('/search?q=' + (searchParams.get('q') || ''))}
                        className="text-sm sm:text-base text-eosc-light-blue hover:text-eosc-dark-blue font-medium"
                    >
                        ← Back to Search Results
                    </button>
                </div>
            </div>

            <div className="flex-1 container mx-auto p-4">
                <div className="flex flex-col md:flex-row gap-4">

                    <div className="flex-1 min-w-0 space-y-4">
                        <div className="bg-eosc-card rounded border border-eosc-border p-4">
                            <h2 className="text-lg font-semibold text-eosc-text mb-2">Files</h2>
                            <FilesList files={files} isFilesLoading={isFilesLoading} error={error}/>
                        </div>

                        <div className="space-y-4">
                            <DataplayInput
                                label={isAdding ? "Loading..." : "Add Group"}
                                onPlay={handleAddGroup}
                                className="w-full max-w-2xl"
                                loading={isAdding}
                            />

                            {isAdding && (
                                <div className="flex justify-center">
                                    <div
                                        className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin"/>
                                </div>
                            )}

                            {fileGroups.map((group, idx) => (
                                <div key={idx} className="bg-eosc-card rounded border border-eosc-border p-4">
                                    <h2 className="text-lg font-semibold text-eosc-text mb-2">
                                        Extra files: Group {idx + 1}
                                    </h2>
                                    <FilesList files={group} isFilesLoading={false} error={null}/>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 container mx-auto py-4 sm:py-6 md:py-8">
                        {currentStep === 'select-analysis' && (
                            <ToolSelectionStep
                                toolSearchText={toolSearchText}
                                setToolSearchText={setToolSearchText}
                                isFilesLoading={isFilesLoading}
                                queryToolResults={queryToolResults}
                                handleToolSelect={handleToolSelect}
                                filesError={filesError}
                                selectedToolId={selectedToolId}
                            />
                        )}
                        {currentStep === 'map-files' && (
                            <FileMappingStep
                                selectedToolId={selectedToolId}
                                toolConfig={toolConfig}
                                files={files}
                                fileParametersMapping={fileParametersMapping}
                                valueParametersMapping={valueParametersMapping}
                                handleFileSlotSet={handleFileSlotSet}
                                handleValueSlotSet={handleValueSlotSet}
                                allParametersMapped={areAllParametersMapped(toolConfig, fileParametersMapping, valueParametersMapping)}
                                onReselectTool={handleStartOver}
                                onSubmit={handleSubmit}
                            />
                        )}
                        {(currentStep === 'submitting' || currentStep === 'monitoring') && (
                            <MonitoringStep
                                statusType={statusType}
                                statusMessage={statusMessage}
                                datasetTitle={datasetTitle}
                                selectedToolId={selectedToolId}
                                toolConfig={toolConfig}
                                taskId={taskId}
                                taskResult={taskResult}
                                onStartOver={handleStartOver}
                            />
                        )}
                    </div>
                </div>
            </div>

            <Footer/>
        </div>
    );
};

export default DataplayerPage;
