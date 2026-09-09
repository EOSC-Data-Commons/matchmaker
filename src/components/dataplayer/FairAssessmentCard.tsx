import {useState} from 'react';
import {AlertCircle, ChevronDown, ChevronUp, Gauge, LoaderIcon, RefreshCw} from 'lucide-react';
import {useFairAssessment} from '@/hooks/useFairAssessment.ts';
import type {
    AssessorId,
    FairCell,
    FairCellResult,
    FairGuidance,
    FairOutcome,
    FairReport,
    FairScores,
} from '@/types/fairTypes.ts';

const ASSESSOR_NAMES: Record<AssessorId, string> = {
    fuji: 'F-UJI',
    fair_champion: 'FAIR Champion',
};

const PRINCIPLE_LABELS = {
    f: 'Findable',
    a: 'Accessible',
    i: 'Interoperable',
    r: 'Reusable',
} as const;

/** Which criteria belong to each principle, matching the proxy's PRINCIPLE_CELLS. */
const PRINCIPLE_CELLS: Record<keyof typeof PRINCIPLE_LABELS, FairCell[]> = {
    f: ['f1', 'f2', 'f3', 'f4'],
    a: ['a1', 'a1_1', 'a1_2', 'a2'],
    i: ['i1', 'i2', 'i3'],
    r: ['r1', 'r1_1', 'r1_2', 'r1_3'],
};

/** `a1_1` reads as "A1.1", which is how the FAIR principles are normally written. */
const cellLabel = (cell: FairCell) => cell.toUpperCase().replace(/_/g, '.');

const OUTCOME_STYLES: Record<FairOutcome, string> = {
    pass: 'bg-green-100 text-green-800 border-green-200',
    partial: 'bg-amber-100 text-amber-800 border-amber-200',
    fail: 'bg-red-100 text-red-800 border-red-200',
    indeterminate: 'bg-gray-100 text-gray-500 border-gray-200',
};

const OUTCOME_LABELS: Record<FairOutcome, string> = {
    pass: 'Pass',
    partial: 'Partial',
    fail: 'Fail',
    indeterminate: 'Not assessed',
};

const scoreColor = (score: number) =>
    score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

/**
 * One principle's score.
 *
 * A null score means nothing was measurable, which is not a zero: F-UJI routinely
 * returns null for Accessible. Showing an empty bar there would read as a failure.
 */
const ScoreBar = ({label, score}: { label: string; score: number | null }) => (
    <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-xs text-gray-600">{label}</span>
        <div className="h-1.5 grow rounded-full bg-gray-100">
            {score !== null && (
                <div className={`h-1.5 rounded-full ${scoreColor(score)}`} style={{width: `${score}%`}}/>
            )}
        </div>
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-gray-600">
            {score === null ? 'not assessed' : `${score}%`}
        </span>
    </div>
);

const AssessorScores = ({assessor, scores}: { assessor: AssessorId; scores: FairScores }) => (
    <div className="rounded-lg border border-gray-200 p-3">
        <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-800">{ASSESSOR_NAMES[assessor] ?? assessor}</span>
            <span className="text-sm tabular-nums text-gray-600">
                {scores.overall === null ? 'no score' : `${scores.overall}% overall`}
            </span>
        </div>
        <div className="flex flex-col gap-1.5">
            {(Object.keys(PRINCIPLE_LABELS) as (keyof typeof PRINCIPLE_LABELS)[]).map(principle => (
                <ScoreBar key={principle} label={PRINCIPLE_LABELS[principle]} score={scores[principle]}/>
            ))}
        </div>
    </div>
);

/**
 * The criteria grid.
 *
 * Each chip shows the proxy's consensus, but the tooltip carries the per-assessor
 * verdicts, because the two assessors disagree often and the consensus is pessimistic:
 * one assessor failing makes the whole cell a fail even when the other passed.
 */
const CellGrid = ({cells}: { cells: FairCellResult[] }) => {
    const byCell = new Map(cells.map(cell => [cell.cell, cell]));

    return (
        <div className="flex flex-col gap-2">
            {(Object.keys(PRINCIPLE_CELLS) as (keyof typeof PRINCIPLE_CELLS)[]).map(principle => (
                <div key={principle} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-xs text-gray-600">{PRINCIPLE_LABELS[principle]}</span>
                    <div className="flex flex-wrap gap-1">
                        {PRINCIPLE_CELLS[principle].map(cell => {
                            const result = byCell.get(cell);
                            const outcome = result?.consensus ?? 'indeterminate';
                            const breakdown = Object.entries(result?.by_assessor ?? {})
                                .map(([id, value]) => `${ASSESSOR_NAMES[id as AssessorId] ?? id}: ${value}`)
                                .join('\n');
                            return (
                                <span
                                    key={cell}
                                    title={`${cellLabel(cell)} — ${OUTCOME_LABELS[outcome]}${breakdown ? `\n${breakdown}` : ''}`}
                                    className={`rounded border px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${OUTCOME_STYLES[outcome]}`}
                                >
                                    {cellLabel(cell)}
                                </span>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

/**
 * What is wrong and, where the assessor says so, how to fix it. This is the part a
 * depositor can act on, so failures come first and passing tests are left out.
 */
const GuidanceList = ({guidance}: { guidance: FairGuidance[] }) => {
    const actionable = guidance.filter(entry => entry.outcome === 'fail' || entry.outcome === 'partial');
    if (actionable.length === 0) {
        return <p className="text-sm font-light text-gray-500">No failing checks to report.</p>;
    }

    return (
        <ul className="flex flex-col gap-2">
            {actionable.map((entry, index) => (
                <li key={`${entry.assessor}-${entry.test}-${index}`}
                    className="rounded-lg border border-gray-200 p-2.5">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        {entry.cell && (
                            <span
                                className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${OUTCOME_STYLES[entry.outcome === 'partial' ? 'partial' : 'fail']}`}>
                                {cellLabel(entry.cell)}
                            </span>
                        )}
                        <span
                            className="text-xs text-gray-500">{ASSESSOR_NAMES[entry.assessor] ?? entry.assessor}</span>
                    </div>
                    {entry.description && (
                        <p className="text-sm font-light text-gray-800">{entry.description}</p>
                    )}
                    {entry.message && (
                        <p className="mt-0.5 text-sm font-light text-gray-500">{entry.message}</p>
                    )}
                    {entry.guidance.map((hint, hintIndex) => (
                        <p key={hintIndex} className="mt-1 text-sm font-light text-gray-700">{hint}</p>
                    ))}
                </li>
            ))}
        </ul>
    );
};

const Report = ({report}: { report: FairReport }) => {
    const [showDetail, setShowDetail] = useState(false);
    const assessors = Object.keys(report.scores) as AssessorId[];
    const actionable = report.guidance.filter(e => e.outcome === 'fail' || e.outcome === 'partial').length;

    return (
        <div className="flex flex-col gap-3">
            {assessors.length === 0 ? (
                <p className="text-sm font-light text-gray-500">
                    No assessor returned a score for this dataset.
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {assessors.map(assessor => {
                        const scores = report.scores[assessor];
                        return scores ? <AssessorScores key={assessor} assessor={assessor} scores={scores}/> : null;
                    })}
                </div>
            )}

            <button
                type="button"
                onClick={() => setShowDetail(v => !v)}
                aria-expanded={showDetail}
                className="flex items-center gap-1 self-start text-sm font-light text-blue-600 hover:text-blue-700 cursor-pointer"
            >
                {showDetail ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                {showDetail ? 'Hide details' : `Show details${actionable > 0 ? ` (${actionable} issues)` : ''}`}
            </button>

            {showDetail && (
                <div className="flex flex-col gap-4 border-t border-gray-200 pt-3">
                    <CellGrid cells={report.cells}/>
                    <GuidanceList guidance={report.guidance}/>
                </div>
            )}
        </div>
    );
};

interface FairAssessmentCardProps {
    /** The dataset's PID: a DOI where there is one, otherwise its URL. */
    pid: string | null;
}

/**
 * FAIR assessment for the dataset open in the dataplayer.
 *
 * Starts collapsed and only looks for an existing result, because a fresh assessment
 * takes ~35s with a DOI and minutes without one. Nobody who came here to launch a tool
 * should pay that cost without asking for it.
 */
export const FairAssessmentCard = ({pid}: FairAssessmentCardProps) => {
    const {state, report, error, finishedAssessors, plannedAssessors, fromCache, isDoiPid, run} =
        useFairAssessment(pid);

    if (!pid) return null;

    const pending = plannedAssessors.filter(a => !finishedAssessors.includes(a));

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-light text-gray-900 flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-gray-400"/>
                    FAIR assessment
                </h2>
                {state === 'ready' && (
                    <button
                        type="button"
                        onClick={() => run({force: true})}
                        className="flex items-center gap-1 text-sm font-light text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                    >
                        <RefreshCw className="h-3.5 w-3.5"/>
                        Re-check
                    </button>
                )}
            </div>

            {!isDoiPid && (
                <p className="text-sm font-light text-gray-500">
                    This dataset has no DOI, so only F-UJI can assess it. Findability and
                    accessibility checks need a resolvable identifier.
                </p>
            )}

            {state === 'checking' && (
                <p className="text-sm font-light text-gray-500">Looking for an existing assessment...</p>
            )}

            {state === 'idle' && (
                <div className="flex flex-col gap-3 items-start">
                    <p className="text-sm font-light text-gray-500">
                        Check how well this dataset follows the FAIR principles. The assessment
                        runs {plannedAssessors.map(a => ASSESSOR_NAMES[a]).join(' and ')} and
                        usually takes under a minute.
                    </p>
                    <button
                        type="button"
                        onClick={() => run({force: false})}
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                        <Gauge className="h-4 w-4"/>
                        Check FAIR score
                    </button>
                </div>
            )}

            {state === 'running' && (
                <div className="flex items-center gap-3">
                    <LoaderIcon className="h-5 w-5 text-blue-600 animate-spin shrink-0"/>
                    <p className="text-sm font-light text-gray-700">
                        {pending.length > 0
                            ? `Waiting for ${pending.map(a => ASSESSOR_NAMES[a]).join(' and ')}...`
                            : 'Collecting results...'}
                    </p>
                </div>
            )}

            {state === 'error' && (
                <div className="flex flex-col gap-3 items-start">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-500 shrink-0"/>
                        <p className="text-sm font-light text-red-600 wrap-break-word">{error}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => run({force: true})}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-light text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                        <RefreshCw className="h-3.5 w-3.5"/>
                        Try again
                    </button>
                </div>
            )}

            {state === 'ready' && report && (
                <>
                    {report.status === 'completed_with_errors' && (
                        <p className="text-sm font-light text-amber-700">
                            One assessor did not finish, so this score is based on partial results.
                        </p>
                    )}
                    {fromCache && (
                        <p className="text-xs font-light text-gray-400">
                            From an earlier assessment of this dataset.
                        </p>
                    )}
                    <Report report={report}/>
                </>
            )}
        </div>
    );
};
