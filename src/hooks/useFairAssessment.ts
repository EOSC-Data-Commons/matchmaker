import {useCallback, useEffect, useRef, useState} from 'react';
import {
    FairAssessmentTimeoutError,
    assessorsForPid,
    createAssessment,
    findLatestCompleted,
    getReport,
    isDoi,
    waitForAssessment,
} from '@/lib/fairApi.ts';
import type {Assessment, AssessorId, FairReport} from '@/types/fairTypes.ts';
import {getUserErrorMessage} from '@/lib/utils.ts';

export type FairState =
/** No result yet, and none stored. Waiting for the user to ask for one. */
    | 'idle'
    /** Looking for a previous result. Cheap, runs on mount. */
    | 'checking'
    /** An assessment is in flight. Expensive: 35s with a DOI, minutes without one. */
    | 'running'
    | 'ready'
    | 'error';

export interface UseFairAssessment {
    state: FairState;
    report: FairReport | null;
    error: string | null;
    /** Which assessors have reported so far, so a slow run can show partial progress. */
    finishedAssessors: AssessorId[];
    /** The assessors this PID is worth running, so the UI can say what it is waiting on. */
    plannedAssessors: AssessorId[];
    /** True when the shown report came from a previous run rather than this session. */
    fromCache: boolean;
    /** FAIR Champion is skipped without a DOI, which caps what can be measured. */
    isDoiPid: boolean;
    /** Queue an assessment. `force` re-runs even when a stored result exists. */
    run: (options?: { force?: boolean }) => void;
}

interface InternalState {
    /** The dataset this state describes, so a stale render can be detected. */
    pid: string | null;
    phase: FairState;
    report: FairReport | null;
    error: string | null;
    finishedAssessors: AssessorId[];
    fromCache: boolean;
}

const initialState = (pid: string | null): InternalState => ({
    pid,
    phase: pid ? 'checking' : 'idle',
    report: null,
    error: null,
    finishedAssessors: [],
    fromCache: false,
});

/**
 * Drives one dataset's FAIR assessment.
 *
 * Deliberately does not assess on mount. A cold run takes ~35s for a DOI and minutes
 * without one, which is far too much to spend on someone who opened the dataplayer to
 * launch a tool. Mount only looks for an already-finished run, which is one cheap
 * request, and the expensive path waits for the user to ask.
 */
export function useFairAssessment(pid: string | null): UseFairAssessment {
    const [state, setState] = useState<InternalState>(() => initialState(pid));

    // Aborts the in-flight run on unmount or when the dataset changes, so a poll
    // started for one dataset cannot resolve into another dataset's card.
    const abortRef = useRef<AbortController | null>(null);
    const liveRef = useRef(true);

    // Reset during render rather than in an effect: the card then never paints one
    // dataset's score while another dataset's PID is already in props. Aborting the
    // previous run belongs in the lookup effect's cleanup below, since a ref cannot
    // be touched during render.
    if (state.pid !== pid) {
        setState(initialState(pid));
    }

    useEffect(() => {
        liveRef.current = true;
        return () => {
            liveRef.current = false;
            abortRef.current?.abort();
        };
    }, []);

    // Look for a previous result whenever the dataset changes. One request, and it
    // means a dataset someone already assessed renders instantly.
    useEffect(() => {
        if (!pid) return;

        let cancelled = false;

        const lookup = async () => {
            try {
                const existing = await findLatestCompleted(pid);
                if (cancelled || !liveRef.current) return;
                if (!existing) {
                    setState(prev => (prev.pid === pid && prev.phase === 'checking'
                        ? {...prev, phase: 'idle'}
                        : prev));
                    return;
                }
                const previous = await getReport(existing.id);
                if (cancelled || !liveRef.current) return;
                setState(prev => (prev.pid === pid && prev.phase === 'checking'
                    ? {...prev, phase: 'ready', report: previous, fromCache: true}
                    : prev));
            } catch {
                // A failed lookup is not worth showing: the user can still run an
                // assessment, which is what the idle state offers.
                if (cancelled || !liveRef.current) return;
                setState(prev => (prev.pid === pid && prev.phase === 'checking'
                    ? {...prev, phase: 'idle'}
                    : prev));
            }
        };

        void lookup();

        return () => {
            cancelled = true;
            // The dataset changed or the card unmounted: stop polling the old run.
            abortRef.current?.abort();
        };
    }, [pid]);

    const run = useCallback(({force = true}: { force?: boolean } = {}) => {
        if (!pid) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const alive = () => !controller.signal.aborted && liveRef.current;
        // Only ever write state that belongs to the dataset this run was started for.
        const update = (patch: Partial<InternalState>) =>
            setState(prev => (prev.pid === pid ? {...prev, ...patch} : prev));

        update({phase: 'running', error: null, finishedAssessors: [], fromCache: false});

        const execute = async () => {
            try {
                if (!force) {
                    const existing = await findLatestCompleted(pid);
                    if (!alive()) return;
                    if (existing) {
                        const previous = await getReport(existing.id);
                        if (!alive()) return;
                        update({phase: 'ready', report: previous, fromCache: true});
                        return;
                    }
                }

                const {id} = await createAssessment({
                    pid,
                    cached: !force,
                    assessors: assessorsForPid(pid),
                });
                if (!alive()) return;

                await waitForAssessment(id, {
                    signal: controller.signal,
                    onProgress: (assessment: Assessment) => {
                        if (!alive()) return;
                        update({finishedAssessors: assessment.results.map(r => r.assessor)});
                    },
                });
                if (!alive()) return;

                const fresh = await getReport(id);
                if (!alive()) return;
                update({phase: 'ready', report: fresh});
            } catch (err) {
                if (!alive()) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                update({
                    phase: 'error',
                    error: err instanceof FairAssessmentTimeoutError
                        ? err.message
                        : getUserErrorMessage(err),
                });
            }
        };

        void execute();
    }, [pid]);

    return {
        state: state.phase,
        report: state.report,
        error: state.error,
        finishedAssessors: state.finishedAssessors,
        plannedAssessors: pid ? assessorsForPid(pid) : [],
        fromCache: state.fromCache,
        isDoiPid: pid ? isDoi(pid) : false,
        run,
    };
}
