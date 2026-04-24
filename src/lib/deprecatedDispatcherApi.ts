// Coordinator API functions

import {
    DispatcherResult,
    FileMetrixFile,
    TaskStatus,
    TaskStatusResponse,
} from "../types/dispatcher";
import { DISPATCHER_CONFIGS, updateOnedataForTarget } from "./dispatcherUtils";
import { fetchWithTimeout } from "./utils";

// Use proxy to avoid CORS issues
const PLAYER_API_BASE = process.env.PLAYER_API_URL || 'https://dev1.player.eosc-data-commons.eu';
const METADATA_ENDPOINT = "/anon_requests/metadata_rocrate/";

/**
 * Submit metadata to the dispatcher
 */
export const submitMetadataToDispatcher = async (
    metadata: unknown,
    timeoutMs: number = 60000, // Default 1 minute timeout
): Promise<{ task_id: string }> => {
    console.debug("Submitting metadata:", JSON.stringify(metadata, null, 2));

    const response = await fetchWithTimeout(
        `${PLAYER_API_BASE}${METADATA_ENDPOINT}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(metadata),
        },
        timeoutMs,
    );

    console.log("Response status:", response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Submission error:", errorText);
        throw new Error(`Submission failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("Response result:", result);

    if (!result.task_id) {
        throw new Error("No task_id returned from dispatcher");
    }

    return result;
};

/**
 * Check task status from dispatcher
 */
export const checkTaskStatus = async (
    taskId: string,
    timeoutMs: number = 60000, // Default 30 seconds timeout for status checks
): Promise<TaskStatusResponse> => {
    const response = await fetchWithTimeout(
        `${PLAYER_API_BASE}/anon_requests/${taskId}`,
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        },
        timeoutMs,
    );

    if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
    }

    return await response.json();
};

/**
 * Prepare final metadata with file mappings
 */
export const prepareDispatcherMetadata = (
    dispatcherType: string,
    fileParameterMappings: Record<number, string>,
    files: FileMetrixFile[],
    datasetTitle?: string | null
): Record<string, unknown> => {
    const config = DISPATCHER_CONFIGS[dispatcherType];

    if (!config) {
        throw new Error(`Invalid dispatcher type: ${dispatcherType}`);
    }

    let metadata = JSON.parse(JSON.stringify(config.template));

    // Update name and description
    if (datasetTitle && metadata['@graph'] && metadata['@graph'][0]) {
        metadata['@graph'][0].name = `${config.name} for: ${datasetTitle}`;
        metadata['@graph'][0].description = `${config.description} - Dataset: ${datasetTitle}`;
    }

    // Apply file mappings to RO-Crate
    Object.entries(fileParameterMappings).forEach(([fileIndexStr, parameter]) => {
        const fileIndex = parseInt(fileIndexStr);
        const file = files[fileIndex];

        if (file) {
            metadata = updateOnedataForTarget(metadata, parameter, file.ro_crate_extensions);
        }
    });

    console.debug('Prepared metadata:', metadata);
    return metadata;
};

/**
 * Poll task status with callback handlers
 */
export const pollTaskStatus = async (
    taskId: string,
    onStatusUpdate: (
    status: TaskStatus,
    message: string,
    result?: DispatcherResult,
  ) => void,
    onComplete: (result: DispatcherResult | null) => void,
    onError: (error: string) => void,
): Promise<void> => {
    const pollInterval = 2000;
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
        try {
            const statusResult = await checkTaskStatus(taskId);

            switch (statusResult.status) {
            case "SUCCESS":
                onStatusUpdate(
                    "SUCCESS",
                    "Virtual Research Environment is ready!",
                    statusResult.result,
                );
                onComplete(statusResult.result || null);
                return;

            case "FAILURE": {
                const errorMsg = `Virtual Research Environment setup failed: ${
                    statusResult.error || "Unknown error"
                }`;
                onStatusUpdate("FAILURE", errorMsg);
                onError(errorMsg);
                return;
            }

            case "PENDING":
            case "STARTED":
            case "RETRY":
                onStatusUpdate(
                    statusResult.status,
                    `Task status: ${statusResult.status}. Please wait...`,
                );
                break;
            }

            if (attempts < maxAttempts) {
                attempts++;
                setTimeout(poll, pollInterval);
            } else {
                onStatusUpdate("PENDING", "Task monitoring timeout.");
                onError("Task monitoring timeout");
            }
        } catch (error) {
            console.error("Polling error:", error);
            if (attempts < maxAttempts) {
                attempts++;
                setTimeout(poll, pollInterval);
            } else {
                const errorMessage = error instanceof Error
                    ? error.message
                    : "Unknown error";
                const msg = `Error checking task status: ${errorMessage}`;
                onStatusUpdate("FAILURE", msg);
                onError(msg);
            }
        }
    };

    setTimeout(poll, pollInterval);
};
