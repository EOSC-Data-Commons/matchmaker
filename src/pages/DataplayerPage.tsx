import {JSX, useEffect, useState} from 'react';
import {useSearchParams, useNavigate} from 'react-router';
import {LoaderIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon} from 'lucide-react';
import {Footer} from '../components/Footer';
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import eoscLogo from '@/assets/logo-eosc-data-commons.svg';
import { DispatchResult, FileMeta, ToolConfig } from '@/types/dataplayerTypes';
import { fetchFilesMetaByDatasetHandle, getDispatchResultById, getToolById, matchToolsByFiles, searchToolsByText, startLaunchTask, taskStatusAsEventSource } from '@/lib/coordinatorApi';

export type TaskStatus = 'PENDING' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'STARTED';

export interface TaskStatusResponse {
    status: TaskStatus;
    result?: DispatchResult;
    error?: string;
}

export type StepType = 'select-analysis' | 'map-files' | 'submitting' | 'monitoring';

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
    const [files, setFiles] = useState<FileMeta[]>([]);
    const [fileParameterMappings, setFileParameterMappings] = useState<Record<number, string>>({});
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [filesError, setFilesError] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            console.log("Start loading");
            try {
                setLoading(true);
                const files = await fetchFilesMetaByDatasetHandle(datasetHandle);
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
    let content: JSX.Element | null;
    if (loading) {
        content = <div className="text-gray-600">Loading...</div>;
    } else if (error) {
        content = <div className="text-red-500">{error}</div>;
    } else if (!files.length) {
        content = <div className="text-gray-500">No files found</div>;
    } else {
        content = (
            <ul style={{ listStyle: "none", padding: 0 }}>
                {files.map((file) => (
                    <li
                        key={file.dataPath}
                        className="flex justify-between items-center p-2 border-b border-gray-200"
                    >
                        <div>
                            {file.isDir ? "📁" : "📄"} {file.filename}
                        </div>

                        <div className="flex gap-4 items-center">
                            {!file.isDir && <span className="text-gray-600">{file.size}</span>}
                            {file.downloadUrl && (
                                <a
                                    href={file.downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                  Download
                                </a>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        );
    }


    // Submission tracking
    const [statusMessage, setStatusMessage] = useState('');
    // TODO: this state type should one to one mapped to tool state in grpc definition.
    const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warning'>('info');
    const [taskId, setTaskId] = useState<string | null>(null);
    const [taskResult, setTaskResult] = useState<DispatchResult | null>(null);

    const [toolConfig, setToolConfig] = useState<ToolConfig | null>(null);

    // user selected files for matching
    const [selectedFiles, setselectedFiles] = useState<FileMeta[]>([]);
    
    useEffect(() => {
        const load = async () => {
            console.log("Start loading");
            try {
                setLoading(true);
                const files = await fetchFilesMetaByDatasetHandle(datasetHandle);

                // TODO: @Ritwik, I not yet provide the checkboxes for user to select files (even not sure that is intuitive)
                // So the seleceted files are initialized with dataset, but I leave this as the port for future file selection support.
                setselectedFiles(files);
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
        if (selectedFiles.length < 1) {
            return;
        }
        async function load() {
            const tools = await matchToolsByFiles(selectedFiles);
            setQueryToolResults(tools);
        }

        load();
    }, [selectedFiles]);

    useEffect(() => {
        async function load() {
            const config = await getToolById(selectedToolId);
            setToolConfig(config);
        }

        if (selectedToolId != null) {
            load();
        }
    }, [selectedToolId]);

    const [queryToolResults, setQueryToolResults] = useState<Record<string, ToolConfig>>({});
    const [toolSearchText, setToolSearchText] =  useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearch(toolSearchText);
        }, 500);

        return () => clearTimeout(timeout);
    }, [toolSearchText]);

    useEffect(() => {
        if (debouncedSearch.trim().length < 2) {
            setQueryToolResults({});
            return;
        }
        async function load() {
            const tools = await searchToolsByText(toolSearchText);
            setQueryToolResults(tools);
        }

        load();
    }, [debouncedSearch, toolSearchText]);

    // Handle tool selection
    const handleToolSelect = async (tool_id: string) => {
        if (!tool_id) return;

        setSelectedToolId(tool_id);
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
        if (!selectedToolId) return;

        try {
            setCurrentStep("submitting");
            setStatusMessage("Preparing Virtual Research Environment metadata...");
            setStatusType("info");

            console.log("selected tool id:" + selectedToolId);
            const slotToFileMapping = ((mapping, fs) => {
                const result: Record<string, FileMeta> = {};

                for (const [idxStr, slot] of Object.entries(mapping)) {
                    const idx = Number(idxStr);
                    result[slot] = fs[idx];
                }
                return result;
            })(fileParameterMappings, files);

            const taskId = await startLaunchTask(selectedToolId, slotToFileMapping);
            setTaskId(taskId);

            setStatusMessage(`Task ${taskId} submitted! Monitoring progress...`);
            setStatusType("info");

            // SSE for task progress update
            const es = taskStatusAsEventSource(taskId);
            es.addEventListener("state", async (event) => {
                const data = JSON.parse(event.data);
                setStatusMessage(data.message);
                setStatusType(
                    data.state === "READY"
                        ? "success"
                        : "info"
                );
                console.warn(data.state);
                if (data.state === "READY") {
                    es.close();
                    
                    try {
                        const dispatcherResult = await getDispatchResultById(taskId);
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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Select a tool</h2>
                <p className="text-sm sm:text-base text-gray-600">Choose the tool you want to
                    use with your dataset</p>
            </div>
            <input
                type="text"
                placeholder="Search tools..."
                value={toolSearchText}
                onChange={(e) => setToolSearchText(e.target.value)}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {Object.entries(queryToolResults).length === 0 ? (
                    <div className="col-span-full text-center py-8 text-gray-500">
                        No tools found.
                    </div>
                ) :
                    (Object.entries(queryToolResults) as [string, ToolConfig][]).map(([key, config]) => (
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
                        onClick={() => selectedToolId && handleToolSelect(selectedToolId)}
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
        if (!selectedToolId) return null;

        const allParametersMapped = areAllParametersMapped(toolConfig, fileParameterMappings);

        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
                <div className="mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Map input files and set input parameters</h2>
                    <p className="text-sm sm:text-base text-gray-600">
                        Setup required input parameters for running tool.
                        Assign files to a tool file input, and each file slot must have exactly one file.</p>

                    <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Selected tool:
                        </p>
                        <p className="text-sm sm:text-base text-gray-900 font-semibold wrap-break-word">
                            {toolConfig ? toolConfig.name : "Loading tool config..."}
                        </p>
                        <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Select VRE to run tool:
                        </p>
                        <p className="text-sm sm:text-base text-gray-900 font-semibold wrap-break-word">
                            (placeholder) this is for different entities of VRE (e.g. galaxy.eu / galaxy.ch if there are more than one)
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
                            setSelectedToolId(null);
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
                        <h2 className="text-lg sm:text-xl font-semibold mb-2">Tool launching status</h2>
                        <p className="text-base sm:text-lg mb-4 wrap-break-word">{statusMessage}</p>

                        {datasetTitle && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-white rounded border">
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Dataset:</p>
                                <p className="text-sm sm:text-base text-gray-900 wrap-break-word">{datasetTitle}</p>
                            </div>
                        )}

                        {selectedToolId && (
                            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-white rounded border">
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                    Tool:
                                </p>
                                <p className="text-sm sm:text-base text-gray-900 wrap-break-word">{toolConfig ? toolConfig.name : "Loading tool config..."}</p>
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">VRE:</p>
                                <p className="text-sm sm:text-base text-gray-900 wrap-break-word">(placeholder for VRE entity)</p>
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
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                    Tool in the Virtual Research Environment is Ready!
                                </p>
                                <p className="text-xs sm:text-sm text-gray-600 mb-3">
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
                                        setSelectedToolId(null);
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

            <div className="container mx-auto p-4">
                {datasetTitle && (
                    <div className="mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs sm:text-sm font-medium text-gray-700">Dataset:</p>
                        <p className="text-sm sm:text-base text-gray-900 wrap-break-word">{datasetTitle}</p>
                    </div>
                )}
            </div>

            <div className="flex-1 container mx-auto p-4">
                <div className="flex flex-col md:flex-row gap-4">

                    <div className="flex-1 min-w-0 space-y-4">
                        <div className="bg-white rounded border p-4">
                            <h2 className="text-lg font-semibold mb-2">Files</h2>
                            {content}
                        </div>
                    </div>

                    <div className="flex-1 container mx-auto py-4 sm:py-6 md:py-8">
                        {currentStep === 'select-analysis' && renderToolSelection()}
                        {currentStep === 'map-files' && renderFileMapping()}
                        {(currentStep === 'submitting' || currentStep === 'monitoring') && renderMonitoring()}
                    </div>
                </div>
            </div>

            <Footer/>
        </div>
    );
};

export default DataplayerPage;
