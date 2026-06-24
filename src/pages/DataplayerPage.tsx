import {useMemo, useState} from 'react';
import {useSearchParams, useNavigate} from 'react-router';
import {User} from 'lucide-react';
import {Footer} from '../components/Footer';
import {useAuth} from '@/hooks/useAuth.ts';
import {loginWithReturn} from '@/lib/authRedirect.ts';
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
} from '@/hooks/useDataplayerHooks';

import {ToolSelectionStep} from '@/components/dataplayer/ToolSelectionStep';
import {SlotsMappingAndFilesSetStep} from '@/components/dataplayer/slotsMappingAndFilesSetStep';
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
    const datasetUrl = searchParams.get('datasetId');
    const navigate = useNavigate();

    const {user, loading: userLoading} = useAuth();

    // Step management
    const [currentStep, setCurrentStep] = useState<StepType>('select-analysis');
    // tool uuid
    const [selectedToolId, setSelectedToolId] = useState<string>(null);

    // File management
    const [filesMapping, setFilesMapping] = useState<Record<string, [FileMeta, string]>>({});
    const [valueParametersMapping, setValueParametersMapping] = useState<Record<string, TypedValue>>({});
    const [filesError, setFilesError] = useState<string | null>(null);

    const isAuthenticated = !userLoading && !!user;
    const {isFilesLoading, files, error, resetDataset} = useDataset(datasetUrl, isAuthenticated);
    const [isAdding, setIsAdding] = useState(false);
    const [fileGroups, setFileGroups] = useState<FileMeta[][]>([]);

    const allFiles = useMemo(
        () => [...fileGroups.flat(), ...files],
        [fileGroups, files]
    );


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
    
    const addToFilesSet = (slotName: string, fileMeta: FileMeta, renameTo: string) => {
        setFilesMapping(prev => {
            const newMapping = { ...prev };

            newMapping[slotName] = [fileMeta, renameTo];

            return newMapping;
        });
    };

    const removeFromFilesSet = (slotName: string) => {
        setFilesMapping(prev => {
            const newMapping = { ...prev };
            delete newMapping[slotName];
            return newMapping;
        });
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
            const slotToValueMapping = valueParametersMapping;

            // console.warn(slotToValueMapping);
            // console.warn(slotToFileMapping);
            // TODO: Need to do the checking before launch, pop warning if rename target conflict.
            const files: Record<string, FileMeta> =
                Object.fromEntries(
                    Object.values(filesMapping).map(([fileMeta, key]) => [key, fileMeta])
                );

            await launch(selectedToolId, datasetUrl, datasetTitle, slotToValueMapping, files, {
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
        setFilesMapping({});
        setValueParametersMapping({});
        resetTask();
    };

    return (
        <div className="min-h-screen flex flex-col bg-eosc-bg font-light items-center">
            {!userLoading && !user && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div
                        className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center border border-gray-100">
                        <div
                            className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <User className="h-8 w-8"/>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Authentication Required</h2>
                        <p className="text-gray-600 mb-8 leading-relaxed">
                            Please log in to your account to load this dataset's files and run analysis tools in the
                            Data Sandbox.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={loginWithReturn}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-sm cursor-pointer"
                            >
                                Log In to Continue
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer"
                            >
                                Return to Home
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <header
                className="w-full bg-white flex justify-between items-center p-4 sm:p-6 border-b border-eosc-border shrink-0">
                <img src={dataCommonsIconBlue} alt="EOSC" className="w-16 h-9 cursor-pointer"
                     onClick={() => navigate('/')}/>
                <p className="text-sm font-light text-eosc-gray">Data Sandbox</p>
            </header>

            <div className="w-full max-w-7xl mx-auto grow flex flex-col px-4 py-8 gap-8">
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
                        <div className="bg-white rounded-xl border border-eosc-border p-6 shadow-sm min-h-100">
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
                                <SlotsMappingAndFilesSetStep
                                    selectedToolId={selectedToolId}
                                    toolConfig={toolConfig}
                                    files={allFiles}
                                    filesMapping={filesMapping}
                                    valueParametersMapping={valueParametersMapping}
                                    addToFilesSet={addToFilesSet}
                                    removeFromFilesSet={removeFromFilesSet}
                                    handleValueSlotSet={handleValueSlotSet}
                                    allParametersMapped={areAllParametersMapped(toolConfig, valueParametersMapping)}
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
