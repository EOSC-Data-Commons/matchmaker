import {fetchWithTimeout, logError} from './utils.ts';
import {
    Assessment,
    AssessmentSummary,
    AssessorId,
    Assessor,
    CreateAssessmentRequest,
    CreateAssessmentResponse,
    FairReport,
    OfflineAssessment,
    TERMINAL_STATUSES,
} from '@/types/fairTypes.ts';

// The FAIR assessment proxy is reached same-origin through the `/api/fair` proxy in
// `server.ts`, which rewrites to the service's own `/api/v1` prefix. Calling the
// service directly would work in dev (it sends `Access-Control-Allow-Origin: *`),
// but breaks as soon as it is hosted on another origin.
const FAIR_API_URL = '/api/fair';

// Submitting and polling are cheap; only the assessors themselves are slow, and they
// run server-side after the POST has already returned.
const REQUEST_TIMEOUT_MS = 15000;

/**
 * How long to keep polling a running assessment.
 *
 * Both assessor plugins use a 180s HTTP timeout and run concurrently, so a run that
 * is still going after ~4 minutes is stuck rather than slow.
 */
export const POLL_TIMEOUT_MS = 240000;
export const POLL_INTERVAL_MS = 3000;

/** Raised when the assessment service is unreachable or returns a server error. */
export class FairServiceUnavailableError extends Error {
    constructor(message?: string) {
        super(message || 'The FAIR assessment service is not available right now. Please try again later.');
        this.name = 'FairServiceUnavailableError';
    }
}

/** Raised when an assessment does not finish within `POLL_TIMEOUT_MS`. */
export class FairAssessmentTimeoutError extends Error {
    constructor(readonly assessmentId: string) {
        super('The FAIR assessment is taking longer than expected. It may still finish in the background.');
        this.name = 'FairAssessmentTimeoutError';
    }
}

/** Best-effort extraction of a backend error message (FastAPI `detail`, or status text). */
async function parseError(response: Response): Promise<string> {
    try {
        const data = await response.json();
        if (data && typeof data.detail === 'string') return data.detail;
    } catch {
        // Non-JSON body (e.g. the proxy's plain-text "Proxy error") — fall through.
    }
    return `${response.status} ${response.statusText}`.trim();
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
    const response = await fetchWithTimeout(
        `${FAIR_API_URL}${path}`,
        {headers: {Accept: 'application/json'}, ...init},
        timeoutMs,
    );

    if (!response.ok) {
        const detail = await parseError(response);
        // 5xx is the service being down; the Express proxy also answers 500 with a
        // plain-text "Proxy error" when the upstream is unreachable at all.
        if (response.status >= 500) {
            throw new FairServiceUnavailableError();
        }
        throw new Error(detail);
    }

    return await response.json() as T;
}

/**
 * Normalises a dataset identifier into the PID the proxy expects.
 *
 * The service strips the doi.org prefixes itself, so this only trims whitespace and
 * rejects the empty case. Kept as the single place callers go through, so the
 * "what counts as a PID" question has one answer.
 */
export function toPid(identifier: string | null | undefined): string | null {
    const trimmed = identifier?.trim();
    return trimmed ? trimmed : null;
}

/**
 * Whether a PID is a DOI.
 *
 * FAIR Champion needs one: given a plain URL it still completes, but takes minutes
 * instead of seconds and returns `f: null` and `a: null`, because nothing under
 * Findable or Accessible is measurable without a resolvable PID. F-UJI handles a
 * plain URL normally, so a non-DOI dataset is worth assessing with F-UJI alone.
 */
export function isDoi(pid: string): boolean {
    return /^(https?:\/\/(dx\.)?doi\.org\/|doi:)?10\.\d{4,9}\//i.test(pid.trim());
}

/** The assessors worth running for a given PID. */
export function assessorsForPid(pid: string): AssessorId[] {
    return isDoi(pid) ? ['fuji', 'fair_champion'] : ['fuji'];
}

/** Lists the assessors the service has enabled. */
export async function listAssessors(): Promise<Assessor[]> {
    try {
        return await request<Assessor[]>('/assessors/');
    } catch (error) {
        logError(error, 'listAssessors');
        throw error;
    }
}

/** Queues an assessment. Returns immediately; the assessors run server-side. */
export async function createAssessment(req: CreateAssessmentRequest): Promise<CreateAssessmentResponse> {
    try {
        return await request<CreateAssessmentResponse>('/assessments/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Accept: 'application/json'},
            body: JSON.stringify({
                mode: 'public',
                cached: true,
                ...req,
            }),
        });
    } catch (error) {
        logError(error, 'createAssessment');
        throw error;
    }
}

/** Fetches one assessment's status and per-assessor outcomes. */
export async function getAssessment(assessmentId: string): Promise<Assessment> {
    try {
        return await request<Assessment>(`/assessments/${encodeURIComponent(assessmentId)}`);
    } catch (error) {
        logError(error, 'getAssessment');
        throw error;
    }
}

/** Fetches the harmonized report: the cell grid, per-assessor scores and guidance. */
export async function getReport(assessmentId: string): Promise<FairReport> {
    try {
        return await request<FairReport>(`/assessments/${encodeURIComponent(assessmentId)}/report`);
    } catch (error) {
        logError(error, 'getReport');
        throw error;
    }
}

/** Lists every assessment recorded for a PID, newest first. */
export async function listAssessments(pid: string): Promise<AssessmentSummary[]> {
    try {
        return await request<AssessmentSummary[]>(`/assessments/?pid=${encodeURIComponent(pid)}`);
    } catch (error) {
        logError(error, 'listAssessments');
        throw error;
    }
}

/**
 * The most recent assessment for a PID that actually produced results, or null.
 *
 * Deliberately not `GET /assessments/latest`: that returns the newest record by
 * `created_at` even when it is still running or failed, so it can hand back a
 * half-filled result. This filters to finished runs and lets the caller show a
 * previous score instantly instead of waiting on a fresh one.
 */
export async function findLatestCompleted(pid: string): Promise<AssessmentSummary | null> {
    const assessments = await listAssessments(pid);
    return assessments.find(
        a => a.status === 'completed' || a.status === 'completed_with_errors',
    ) ?? null;
}

/**
 * Scores a metadata blob without publishing it. Synchronous and not stored, so
 * unlike the PID-based flow there is nothing to poll.
 */
export async function assessOffline(metadata: Record<string, unknown>): Promise<OfflineAssessment> {
    try {
        return await request<OfflineAssessment>('/assessments/offline', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Accept: 'application/json'},
            body: JSON.stringify({metadata}),
        }, 60000);
    } catch (error) {
        logError(error, 'assessOffline');
        throw error;
    }
}

export interface PollOptions {
    /** Called on every poll, so the UI can show which assessors have landed so far. */
    onProgress?: (assessment: Assessment) => void;
    signal?: AbortSignal;
    intervalMs?: number;
    timeoutMs?: number;
}

const delay = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        if (signal?.aborted) return onAbort();
        signal?.addEventListener('abort', onAbort, {once: true});
    });

/**
 * Polls an assessment until it reaches a terminal state.
 *
 * There is no SSE or webhook on the service, so polling is the only option.
 * Resolves on `failed` as well as the completed states: the caller decides how to
 * present a failed run, and a `completed_with_errors` run still carries the
 * results of whichever assessor did succeed.
 */
export async function waitForAssessment(
    assessmentId: string,
    {onProgress, signal, intervalMs = POLL_INTERVAL_MS, timeoutMs = POLL_TIMEOUT_MS}: PollOptions = {},
): Promise<Assessment> {
    const deadline = Date.now() + timeoutMs;

    for (; ;) {
        const assessment = await getAssessment(assessmentId);
        onProgress?.(assessment);

        if (TERMINAL_STATUSES.includes(assessment.status)) {
            return assessment;
        }
        if (Date.now() >= deadline) {
            throw new FairAssessmentTimeoutError(assessmentId);
        }
        await delay(intervalMs, signal);
    }
}

/**
 * Runs the whole flow for a dataset: reuse a finished assessment when the service
 * already has one, otherwise queue a fresh run and poll it, then fetch the report.
 *
 * Reuse matters because a cold run takes ~35s for a DOI and minutes without one,
 * which is far too long to spend on someone who opened the page to do something else.
 */
export async function assessDataset(
    pid: string,
    {reuseExisting = true, ...options}: PollOptions & { reuseExisting?: boolean } = {},
): Promise<FairReport> {
    if (reuseExisting) {
        try {
            const existing = await findLatestCompleted(pid);
            if (existing) return await getReport(existing.id);
        } catch (error) {
            // A failed lookup is not a reason to skip the assessment itself.
            logError(error, 'assessDataset/reuse');
        }
    }

    const {id} = await createAssessment({pid, assessors: assessorsForPid(pid)});
    await waitForAssessment(id, options);
    return await getReport(id);
}
