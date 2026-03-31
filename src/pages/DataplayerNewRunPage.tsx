import {useEffect, useState} from 'react';
import {useSearchParams, useNavigate} from 'react-router';
import {LoaderIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon} from 'lucide-react';
import {Footer} from '../components/Footer';
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import eoscLogo from '@/assets/logo-eosc-data-commons.svg';
import { fetchWithTimeout } from '@/lib/utils';
import { FileMeta } from '@/lib/grpcClient';

export interface FileMetrixResponse {
    files: FileMetrixFile[];
}

const FILEMETRIX_BASE = 'https://filemetrix.labs.dansdemo.nl/api/v1';

export type TaskStatus = 'PENDING' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'STARTED';

export interface DispatcherResult {
    url?: string;
}

export interface TaskStatusResponse {
    status: TaskStatus;
    result?: DispatcherResult;
    error?: string;
}

export type StepType = 'select-analysis' | 'map-files' | 'submitting' | 'monitoring';

export interface FileMetrixFile {
    link: string;
    name: string;
    size: number;
    hash: string | null;
    hash_type: string;
    ro_crate_extensions: {
        'onedata:onezoneDomain': string;
        'onedata:spaceId': string;
        'onedata:fileId': string;
        'onedata:publicAccess': boolean;
    };
}

export interface FileMetrixResponse {
    files: FileMetrixFile[];
}

export interface DispatcherConfig {
    name: string;
    description: string;
    template: Record<string, unknown>;
    datasetHandle: string;
    parameters: string[];
}


export interface DispatcherConfig {
    name: string;
    description: string;
    template: Record<string, unknown>;
    datasetHandle: string;
    parameters: string[];
}

/**
 * Check if all required analysis parameters are mapped
 */
const areAllParametersMapped = (
    config: ToolConfig,
    fileParameterMappings: Record<number, string>
): boolean => {
    if (!config) return false;

    const mappedParameters = new Set(Object.values(fileParameterMappings));

    // All analysis parameters must be mapped exactly once
    return config.slots.every(param => mappedParameters.has(param));
};


const fetchFilesLegacy = async (
    datasetHandle: string,
    timeoutMs: number = 60000 // Default 1 minute timeout
): Promise<FileMeta[]> => {
    const response = await fetchWithTimeout(
        `${FILEMETRIX_BASE}/${encodeURIComponent(datasetHandle)}`,
        {},
        timeoutMs
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status}`);
    }

    const {files} =  await response.json() as { files: FileMeta[] };
    return files;
};

interface ToolConfig {
    name: string;
    description: string;
    slots: string[];
}

const FoundTools: Record<string, ToolConfig> = {
    "uuid-1": {
        name: 'Text file reversion (Galaxy)',
        description: 'Reverse the content of a text file',
        slots: ['simpletext_input']
    },
    "uuid-2": {
        name: 'OCR + word cloud (Galaxy)',
        description: 'Perform OCR on an image and generate a word cloud',
        slots: ['Input Image', 'Upload Stopwords']
    }
};

const queryTools = async (): Promise<Record<string, ToolConfig>> => {
    return FoundTools;
}

const getToolConfigById = async (id: string): Promise<ToolConfig> => {
    console.debug("get tool config by its id: " + id);
    // XXX: this is a call to the tool registry through coordinator rpc.
    // and put inside the useeffect
    return FoundTools[id]
}

export const DataplayerPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Step management
    const [currentStep, setCurrentStep] = useState<StepType>('select-analysis');
    const [selectedTool, setSelectedTool] = useState<string>(null);

    // File management
    const [files, setFiles] = useState<FileMeta[]>([]);
    const [fileParameterMappings, setFileParameterMappings] = useState<Record<number, string>>({});
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [filesError, setFilesError] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Submission tracking
    const [statusMessage, setStatusMessage] = useState('');
    // TODO: this state type should one to one mapped to tool state in grpc definition.
    const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warning'>('info');
    const [taskId, setTaskId] = useState<string | null>(null);
    const [taskResult, setTaskResult] = useState<DispatcherResult | null>(null);

    const datasetTitle = searchParams.get('title');
    const datasetHandle = searchParams.get('datasetId');

    const [toolConfig, setToolConfig] = useState<ToolConfig | null>(null);
    
    useEffect(() => {
        const load = async () => {
            console.log("Start loading");
            try {
                setLoading(true);
                // TODO: I should wrap api call in a function so it is well typed.
                const res = await fetch(`/api/coordinator/files?handle=${encodeURIComponent(datasetHandle)}`);
                const files = await res.json();
                console.log("Fetched data");
                setFiles(files);
            } catch (err) {
                console.error(err);
                setError("Failed to fetch files");
            } finally {
                setLoading(false);
                console.log("Finished loading");
            }
        };

        load();
    }, [datasetHandle]);

    useEffect(() => {
        async function load() {
            const config = await getToolConfigById(selectedTool);
            setToolConfig(config);
        }

        if (selectedTool != null) {
            load();
        }
    }, [selectedTool]);

    const [queryToolResults, setQueryToolResults] = useState<Record<string, ToolConfig>>({});

    useEffect(() => {
        async function load() {
            const tools = await queryTools();
            setQueryToolResults(tools);
        }

        load();
    }, []);

    // Handle tool selection
    const handleToolSelect = async (tool_id: string) => {
        if (!tool_id) return;

        setSelectedTool(tool_id);
        setLoadingFiles(true);
        setFilesError(null);

        try {
            // const files = await fetchFilesLegacy(datasetHandle);
            // setFiles(files);
            setCurrentStep('map-files');
        } catch (error) {
            console.error('Error fetching files:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setFilesError(`Failed to load files: ${errorMessage}`);
        } finally {
            setLoadingFiles(false);
        }
    };


    // Handle input slot mapping change
    const handleSlotSet = (fileIndex: number, slotName: string) => {
        setFileParameterMappings(prev => {
            const newMappings = {...prev};

            // Remove this slot from any other file
            Object.keys(newMappings).forEach(key => {
                if (newMappings[parseInt(key)] === slotName) {
                    delete newMappings[parseInt(key)];
                }
            });

            // Set new mapping (or remove if 'none')
            if (slotName === 'none') {
                delete newMappings[fileIndex];
            } else {
                newMappings[fileIndex] = slotName;
            }

            return newMappings;
        });
    };

    const handleSubmit = async () => {
        if (!selectedTool) return;

        try {
            setCurrentStep("submitting");
            setStatusMessage("Preparing Virtual Research Environment metadata...");
            setStatusType("info");

            console.log("selected tool id:" + selectedTool);
            const slotToMetaMapping = ((mapping, fs) => {
                const result: Record<string, FileMeta> = {};

                for (const [idxStr, slot] of Object.entries(mapping)) {
                    const idx = Number(idxStr);
                    result[slot] = fs[idx];
                }
                return result;
            })(fileParameterMappings, files);

            // TODO: having a type for this call will be very helpful.
            const statusRes = await fetch("/api/coordinator/start-task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selectedTool, slotToMetaMapping }),
            });

            if (!statusRes.ok) throw new Error("Failed to start task");

            const taskId = await statusRes.json();
            setTaskId(taskId);
            setStatusMessage("Task submitted! Monitoring progress...");
            setStatusType("info");

            console.warn(taskId);

            // SSE for task progress
            const sse = new EventSource(`/api/coordinator/task-status/${taskId}`);

            sse.addEventListener("state", async (event) => {
                const data = JSON.parse(event.data);
                setStatusMessage(data.message);
                setStatusType(
                    data.state === "READY"
                        ? "success"
                        : "info"
                );
                console.warn(data.state);
                if (data.state === "READY") {
                    sse.close();
                    
                    try {
                        const toolRes = await fetch(`/api/coordinator/tasks-result/${taskId}`, {
                            method: "GET",
                        });
                        console.warn(toolRes);

                        if (!toolRes.ok) throw new Error("Failed to fetch result");

                        const url = await toolRes.text();

                        const dispatcherResult: DispatcherResult = { url };
                        setTaskResult(dispatcherResult);
                        setCurrentStep("monitoring");
                        setStatusMessage("Virtual Research Environment task completed!");
                    } catch (err) {
                        console.error(err);
                        setStatusMessage("Failed to fetch task result");
                        setCurrentStep("map-files");
                        setStatusType("error");
                    }
                }
            });
        } catch (err) {
            console.error(err);
            setStatusMessage(err instanceof Error ? err.message : "Unknown error");
            setStatusType("error");
            setCurrentStep("map-files");
        }
    };


    const getStatusIcon = () => {
        switch (statusType) {
        case 'success':
            return <CheckCircleIcon className="h-8 w-8 text-green-600"/>;
        case 'error':
            return <XCircleIcon className="h-8 w-8 text-red-600"/>;
        case 'warning':
            return <AlertCircleIcon className="h-8 w-8 text-yellow-600"/>;
        default:
            return <LoaderIcon className="h-8 w-8 text-blue-600 animate-spin"/>;
        }
    };

    const getStatusColorClass = () => {
        switch (statusType) {
        case 'success':
            return 'text-green-700 bg-green-50 border-green-200';
        case 'error':
            return 'text-red-700 bg-red-50 border-red-200';
        case 'warning':
            return 'text-yellow-700 bg-yellow-50 border-yellow-200';
        default:
            return 'text-blue-700 bg-blue-50 border-blue-200';
        }
    };

    // Render VRE selection step
    const renderToolSelection = () => (
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Select Virtual Research
                    Environment</h2>
                <p className="text-sm sm:text-base text-gray-600">Choose the Virtual Research Environment you want to
                    use with your dataset</p>
                {datasetTitle && (
                    <div className="mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs sm:text-sm font-medium text-gray-700">Dataset:</p>
                        <p className="text-sm sm:text-base text-gray-900 wrap-break-word">{datasetTitle}</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {(Object.entries(queryToolResults) as [string, ToolConfig][]).map(([key, config]) => (
                    <button
                        key={key}
                        onClick={() => handleToolSelect(key)}
                        disabled={loadingFiles}
                        className="p-4 sm:p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">{config.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-600">{config.description}</p>
                    </button>
                ))}
            </div>

            {loadingFiles && (
                <div
                    className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2 sm:gap-3">
                    <LoaderIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 animate-spin shrink-0"/>
                    <p className="text-sm sm:text-base text-blue-900">Loading files from FileMetrix...</p>
                </div>
            )}

            {filesError && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm sm:text-base text-red-900 wrap-break-word">{filesError}</p>
                    <button
                        onClick={() => selectedTool && handleToolSelect(selectedTool)}
                        className="mt-2 sm:mt-3 text-xs sm:text-sm text-red-700 underline"
                    >
                        Try again
                    </button>
                </div>
            )}

            <div className="mt-4 sm:mt-6">
                <button
                    onClick={() => navigate('/search?q=' + (searchParams.get('q') || ''))}
                    className="text-sm sm:text-base text-blue-600 hover:text-blue-700 font-medium"
                >
                    ← Back to Search Results
                </button>
            </div>
        </div>
    );

    // Render file mapping step
    const renderFileMapping = () => {
        if (!selectedTool) return null;

        const allParametersMapped = areAllParametersMapped(toolConfig, fileParameterMappings);

        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
                <div className="mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Map Files to VRE Parameters</h2>
                    <p className="text-sm sm:text-base text-gray-600">Assign each file to a Virtual Research Environment
                        parameter. Each
                        parameter must have
                        exactly one file.</p>

                    <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Selected Virtual Research
                            Environment:</p>
                        <p className="text-sm sm:text-base text-gray-900 font-semibold wrap-break-word">
                            {toolConfig ? toolConfig.name : "Loading tool config..."}
                        </p>
                    </div>
                </div>

                {/* Required Parameters Info */}
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Required Parameters:</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {toolConfig ? toolConfig.slots.map(param => {
                            const isMapped = Object.values(fileParameterMappings).includes(param);
                            return (
                                <span
                                    key={param}
                                    className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                                        isMapped
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                >
                                    {param} {isMapped ? '✓' : '⚠'}
                                </span>
                            );
                        }) : "Loading tool config"}
                    </div>
                </div>

                {/* Files List - Mobile: Cards, Desktop: Table */}
                {/* Mobile View (Cards) */}
                <div className="md:hidden space-y-3">
                    {files.map((file, index) => (
                        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                            <div className="mb-3">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-1">File Name</p>
                                <p className="text-sm text-gray-900 wrap-break-word">{file.filename}</p>
                            </div>
                            <div className="mb-3">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Size</p>
                                <p className="text-sm text-gray-700">{file.size}</p>
                            </div>
                            <div>
                                <label htmlFor={`param-mobile-${index}`}
                                    className="text-xs font-medium text-gray-500 uppercase block mb-1">
                                    Parameter
                                </label>
                                <select
                                    id={`param-mobile-${index}`}
                                    value={fileParameterMappings[index] || 'none'}
                                    onChange={(e) => handleSlotSet(index, e.target.value)}
                                    className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="none">None</option>
                                    {toolConfig ? toolConfig.slots.map(param => (
                                        <option key={param} value={param}>
                                            {param}
                                        </option>
                                    )): "Loading tool ..."}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop View (Table) */}
                <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    File Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Size
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Parameter
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {files.map((file, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-900 wrap-break-word">
                                            {file.filename}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                                            {file.size}
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={fileParameterMappings[index] || 'none'}
                                                onChange={(e) => handleSlotSet(index, e.target.value)}
                                                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                <option value="none">None</option>
                                                {toolConfig ? toolConfig.slots.map(param => (
                                                    <option key={param} value={param}>
                                                        {param}
                                                    </option>
                                                )) : "Loading tool ..."}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Action Buttons */}
                <div
                    className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                    <button
                        onClick={() => {
                            setCurrentStep('select-analysis');
                            setSelectedTool(null);
                            setFiles([]);
                            setFileParameterMappings({});
                        }}
                        className="text-sm sm:text-base text-blue-600 hover:text-blue-700 font-medium text-center sm:text-left"
                    >
                        ← Change Virtual Research Environment
                    </button>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                        {!allParametersMapped && (
                            <p className="text-xs sm:text-sm text-yellow-700 text-center sm:text-right">
                                Map all required parameters to proceed
                            </p>
                        )}
                        <button
                            onClick={handleSubmit}
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

    // Render submitting/monitoring step
    const renderMonitoring = () => (
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className={`rounded-lg border-2 p-4 sm:p-6 md:p-8 ${getStatusColorClass()}`}>
                <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className="shrink-0">
                        {getStatusIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg sm:text-xl font-semibold mb-2">Virtual Research Environment Status</h2>
                        <p className="text-base sm:text-lg mb-4 wrap-break-word">{statusMessage}</p>

                        {selectedTool && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-white rounded border">
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Virtual Research
                                    Environment:</p>
                                <p className="text-sm sm:text-base text-gray-900 wrap-break-word">{toolConfig ? toolConfig.name : "Loading tool config..."}</p>
                            </div>
                        )}

                        {datasetTitle && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-white rounded border">
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Dataset:</p>
                                <p className="text-sm sm:text-base text-gray-900 wrap-break-word">{datasetTitle}</p>
                            </div>
                        )}

                        {taskId && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-white rounded border">
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Task ID:</p>
                                <p className="text-xs sm:text-sm text-gray-900 font-mono break-all">{taskId}</p>
                            </div>
                        )}

                        {taskResult && taskResult.url && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-white rounded border">
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Virtual Research
                                    Environment is Ready!</p>
                                <p className="text-xs sm:text-sm text-gray-600 mb-3">Your Virtual Research Environment
                                    is ready to run your analysis.</p>
                                <button
                                    onClick={() => window.open(taskResult.url, '_blank', 'noopener,noreferrer')}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 transition-colors cursor-pointer"
                                >
                                    Open Virtual Research Environment →
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mt-4 sm:mt-6">
                            <button
                                onClick={() => navigate('/search?q=' + (searchParams.get('q') || ''))}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                                Back to Search Results
                            </button>

                            {statusType === 'error' && (
                                <button
                                    onClick={() => {
                                        setCurrentStep('select-analysis');
                                        setSelectedTool(null);
                                        setFiles([]);
                                        setFileParameterMappings({});
                                        setTaskId(null);
                                        setTaskResult(null);
                                    }}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 transition-colors cursor-pointer"
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

    return (
        <div className="min-h-screen flex flex-col">
            <header className="border-b border-gray-200 bg-white">
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
                                <p className="text-xs sm:text-sm text-gray-600">Playing with data...!!!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* <div> file list and selection (unimplemnted) </div> */}

            <main className="flex-1 container mx-auto py-4 sm:py-6 md:py-8">
                {currentStep === 'select-analysis' && renderToolSelection()}
                {currentStep === 'map-files' && renderFileMapping()}
                {(currentStep === 'submitting' || currentStep === 'monitoring') && renderMonitoring()}
            </main>

            <Footer/>
        </div>
    );
};

export default DataplayerPage;
