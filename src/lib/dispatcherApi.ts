// Dispatcher API functions

import {
    FileMetrixResponse,
    TaskStatusResponse,
    DispatcherResult,
    TaskStatus
} from '../types/dispatcher';
import {fetchWithTimeout} from './utils';

// Use proxy to avoid CORS issues
const API_BASE = '/api/player';
const METADATA_ENDPOINT = '/anon_requests/metadata_rocrate/';
const FILEMETRIX_BASE = 'https://filemetrix.eosc-data-commons.dansdemo.nl/api/v1';

/**
 * Fetch files from FileMetrix API for a given dataset handle
 */
export const fetchFilesFromMetrix = async (
    datasetHandle: string,
    timeoutMs: number = 60000 // Default 1 minute timeout
): Promise<FileMetrixResponse> => {
    const response = await fetchWithTimeout(
        `${FILEMETRIX_BASE}/${encodeURIComponent(datasetHandle)}`,
        {},
        timeoutMs
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status}`);
    }

    return await response.json();
};

/**
 * Submit metadata to the dispatcher
 */
export const submitMetadataToDispatcher = async (
    metadata: unknown,
    timeoutMs: number = 60000 // Default 1 minute timeout
): Promise<{ task_id: string }> => {
    console.log('Submitting metadata:', JSON.stringify(metadata, null, 2));

    const response = await fetchWithTimeout(
        `${API_BASE}${METADATA_ENDPOINT}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        },
        timeoutMs
    );

    console.log('Response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Submission error:', errorText);
        throw new Error(`Submission failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Response result:', result);

    if (!result.task_id) {
        throw new Error('No task_id returned from dispatcher');
    }

    return result;
};

/**
 * Check task status from dispatcher
 */
export const checkTaskStatus = async (
    taskId: string,
    timeoutMs: number = 60000 // Default 30 seconds timeout for status checks
): Promise<TaskStatusResponse> => {
    const response = await fetchWithTimeout(
        `${API_BASE}/anon_requests/${taskId}`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        },
        timeoutMs
    );

    if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
    }

    return await response.json();
};

/**
 * Poll task status with callback handlers
 */
export const pollTaskStatus = async (
    taskId: string,
    onStatusUpdate: (status: TaskStatus, message: string, result?: DispatcherResult) => void,
    onComplete: (result: DispatcherResult | null) => void,
    onError: (error: string) => void
): Promise<void> => {
    const pollInterval = 2000;
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
        try {
            const statusResult = await checkTaskStatus(taskId);

            switch (statusResult.status) {
                case 'SUCCESS':
                    onStatusUpdate('SUCCESS', 'Virtual Research Environment is ready!', statusResult.result);
                    onComplete(statusResult.result || null);
                    return;

                case 'FAILURE': {
                    const errorMsg = `Virtual Research Environment setup failed: ${statusResult.error || 'Unknown error'}`;
                    onStatusUpdate('FAILURE', errorMsg);
                    onError(errorMsg);
                    return;
                }

                case 'PENDING':
                case 'STARTED':
                case 'RETRY':
                    onStatusUpdate(statusResult.status, `Task status: ${statusResult.status}. Please wait...`);
                    break;
            }

            if (attempts < maxAttempts) {
                attempts++;
                setTimeout(poll, pollInterval);
            } else {
                onStatusUpdate('PENDING', 'Task monitoring timeout.');
                onError('Task monitoring timeout');
            }
        } catch (error) {
            console.error('Polling error:', error);
            if (attempts < maxAttempts) {
                attempts++;
                setTimeout(poll, pollInterval);
            } else {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const msg = `Error checking task status: ${errorMessage}`;
                onStatusUpdate('FAILURE', msg);
                onError(msg);
            }
        }
    };

    setTimeout(poll, pollInterval);
};

