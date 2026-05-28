import {useState} from 'react';
import {useSearchParams, useNavigate} from 'react-router';
import {Footer} from '../components/Footer';
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
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

            if (fileIndex === -1) {
                delete newMapping[slotName];
            } else {
                newMapping[slotName] = fileIndex;
            }

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
        <div className="min-h-screen flex flex-col bg-eosc-bg font-light items-center">
            <header
                className="w-full bg-white flex justify-between items-center p-4 sm:p-6 border-b border-eosc-border flex-shrink-0">
                <img src={dataCommonsIconBlue} alt="EOSC" className="w-16 h-9 cursor-pointer"
                     onClick={() => navigate('/')}/>
                <p className="text-sm font-light text-eosc-gray">Data Sandbox</p>
            </header>

            <div className="w-full max-w-7xl mx-auto flex-grow flex flex-col px-4 py-8 gap-8">
                {/* Top Section */}
                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => navigate('/search?q=' + (searchParams.get('q') || ''))}
                        className="self-start text-sm text-eosc-gray hover:text-eosc-light-blue font-light flex items-center transition-colors"
                    >
                        ← Back to Search Results
                    </button>
                    {datasetTitle && (
                        <div className="bg-white rounded-xl border border-eosc-border p-6 shadow-sm">
                            <p className="text-sm text-eosc-gray mb-1">Dataset</p>
                            <h1 className="text-xl font-light text-eosc-text">{datasetTitle}</h1>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left Panel: Files */}
                    <div className="w-full lg:w-2/4 flex flex-col gap-6">
                        <div className="bg-white rounded-xl border border-eosc-border p-6 shadow-sm">
                            <h2 className="text-lg font-light text-eosc-text mb-4">Files</h2>
                            <FilesList files={files} isFilesLoading={isFilesLoading} error={error}/>
                        </div>

                        <div
                            className="bg-white rounded-xl border border-eosc-border p-6 shadow-sm flex flex-col gap-4 ">
                            <h2 className="text-lg font-light text-eosc-text">Additional Datasets</h2>
                            <DataplayInput
                                label={isAdding ? "Loading..." : "Add"}
                                onPlay={handleAddGroup}
                                className="w-full"
                                loading={isAdding}
                            />

                            {isAdding && (
                                <div className="flex justify-center mt-2">
                                    <div
                                        className="w-6 h-6 border-2 border-gray-300 border-t-eosc-light-blue rounded-full animate-spin"/>
                                </div>
                            )}

                            {fileGroups.map((group, idx) => (
                                <div key={idx} className="mt-2 border-t border-eosc-border pt-4">
                                    <h3 className="text-md font-light text-eosc-text mb-2">
                                        Group {idx + 1}
                                    </h3>
                                    <FilesList files={group} isFilesLoading={false} error={null}/>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel: Tools / Steps */}
                    <div className="w-full lg:w-2/4 flex flex-col">
                        <div className="bg-white rounded-xl border border-eosc-border p-6 shadow-sm min-h-[400px]">
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
            </div>

            <Footer/>
        </div>
    );
};

export default DataplayerPage;
