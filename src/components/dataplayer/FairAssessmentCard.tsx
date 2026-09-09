import {useState} from 'react';
import {AlertCircle, ExternalLink, Gauge, LoaderIcon, RefreshCw} from 'lucide-react';
import {useFairAssessment} from '@/hooks/useFairAssessment.ts';
import {rawReportUrl} from '@/lib/fairApi.ts';
import {
    CELL_PLAIN,
    CELL_PRINCIPLES,
    DERIVED_CELLS,
    PRINCIPLE_BLURBS,
    PRINCIPLE_CELLS,
    PRINCIPLE_NAMES,
    cellLabel,
    scoreBasis,
} from '@/lib/fairScoring.ts';
import type {
    Assessment,
    AssessorId,
    FairCellResult,
    FairGuidance,
    FairPrinciple,
    FairReport,
    FairScores,
    GuidanceOutcome,
} from '@/types/fairTypes.ts';

const FAIR_PRINCIPLES_URL = 'https://www.gofair.foundation/fair-principles';

const ASSESSOR_NAMES: Record<string, string> = {
    fuji: 'F-UJI',
    fair_champion: 'FAIR Champion',
};

const assessorName = (id: AssessorId) => ASSESSOR_NAMES[id] ?? id;

const OUTCOME_STYLES: Record<GuidanceOutcome, string> = {
    pass: 'bg-green-100 text-green-800 border-green-300',
    partial: 'bg-amber-100 text-amber-900 border-amber-300',
    fail: 'bg-red-100 text-red-800 border-red-300',
    indeterminate: 'bg-gray-100 text-gray-600 border-gray-300',
    error: 'bg-red-50 text-red-700 border-red-200',
    not_applicable: 'bg-gray-100 text-gray-600 border-gray-300',
    unavailable: 'bg-gray-100 text-gray-600 border-gray-300',
};

const OUTCOME_LABELS: Record<GuidanceOutcome, string> = {
    pass: 'Pass',
    partial: 'Partial',
    fail: 'Fail',
    indeterminate: 'Not assessed',
    error: 'Error',
    not_applicable: 'Not applicable',
    unavailable: 'Unavailable',
};

/** Failures first: the order a reader most likely wants, without dropping anything. */
const OUTCOME_ORDER: GuidanceOutcome[] =
    ['fail', 'partial', 'error', 'indeterminate', 'unavailable', 'not_applicable', 'pass'];

const OutcomeChip = ({outcome}: { outcome: GuidanceOutcome }) => (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${OUTCOME_STYLES[outcome]}`}>
        {OUTCOME_LABELS[outcome]}
    </span>
);

const scoreColor = (score: number) =>
    score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

const formatDate = (iso: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'});
};

/**
 * Where the numbers came from: when, from which assessor versions, against what.
 *
 * A FAIR score is a claim about a dataset, and a claim nobody can trace back is not
 * worth much. R1.2 asks datasets for exactly this, so withholding it here would be
 * hard to defend.
 */
const Provenance = ({assessment, report}: { assessment: Assessment | null; report: FairReport }) => {
    const finishedOn = formatDate(assessment?.completed_at ?? assessment?.created_at ?? null);
    const versions = (assessment?.results ?? [])
        .map(row => `${assessorName(row.assessor)} ${row.assessor_version}`)
        .join(', ');

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            {finishedOn && <span>Assessed {finishedOn}</span>}
            {versions && <><span aria-hidden="true">·</span><span>{versions}</span></>}
            {assessment?.mode && (
                <>
                    <span aria-hidden="true">·</span>
                    <span>{assessment.mode === 'cached' ? 'gateway metadata' : 'published metadata'}</span>
                </>
            )}
            <span aria-hidden="true">·</span>
            <a
                href={rawReportUrl(report.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 underline"
            >
                Full assessor output
                <ExternalLink className="h-3 w-3"/>
            </a>
        </div>
    );
};

const PrincipleScore = ({
                            principle, score, counted, total,
                        }: { principle: FairPrinciple; score: number | null; counted: number; total: number }) => (
    <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-xs text-gray-700">{PRINCIPLE_NAMES[principle]}</span>
        <div className="h-1.5 w-24 shrink-0 rounded-full bg-gray-100">
            {score !== null && (
                <div className={`h-1.5 rounded-full ${scoreColor(score)}`} style={{width: `${score}%`}}/>
            )}
        </div>
        <span className="w-24 shrink-0 text-xs tabular-nums text-gray-700">
            {score === null ? 'not assessed' : `${score}%`}
        </span>
        <span className="text-xs text-gray-500">
            {counted === 0
                ? `nothing measured of ${total} criteria`
                : `from ${counted} of ${total} criteria`}
        </span>
    </div>
);

/**
 * One assessor's scores, each stated with the evidence behind it. 100% from one
 * criterion and 100% from four are very different claims, so the count is not
 * optional detail.
 */
const AssessorScores = ({assessor, scores, cells}: {
    assessor: AssessorId;
    scores: FairScores;
    cells: FairCellResult[];
}) => (
    <div role="group" aria-label={assessorName(assessor)} className="rounded-lg border border-gray-200 p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-gray-800">{assessorName(assessor)}</span>
            <span className="text-sm tabular-nums text-gray-700">
                {scores.overall === null ? 'no score' : `${scores.overall}% overall`}
            </span>
        </div>
        <div className="flex flex-col gap-1.5">
            {(Object.keys(PRINCIPLE_NAMES) as FairPrinciple[]).map(principle => {
                const {counted, total} = scoreBasis(cells, assessor, principle);
                return (
                    <PrincipleScore
                        key={principle}
                        principle={principle}
                        score={scores[principle]}
                        counted={counted}
                        total={total}
                    />
                );
            })}
        </div>
    </div>
);

/**
 * Every criterion, with each assessor's own verdict spelled out.
 *
 * A real table rather than chips with tooltips: the per-assessor verdicts have to be
 * readable by keyboard, screen reader and on touch, not only on hover.
 */
const CriteriaTable = ({cells, assessors}: { cells: FairCellResult[]; assessors: AssessorId[] }) => {
    const byCell = new Map(cells.map(cell => [cell.cell, cell]));

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                    Every FAIR criterion, with each assessor&apos;s verdict
                </caption>
                <thead>
                <tr className="border-b border-gray-200">
                    <th scope="col" className="py-1.5 pr-2 text-xs font-medium text-gray-500">Criterion</th>
                    {assessors.map(assessor => (
                        <th key={assessor} scope="col" className="py-1.5 pr-2 text-xs font-medium text-gray-500">
                            {assessorName(assessor)}
                        </th>
                    ))}
                </tr>
                </thead>
                {(Object.keys(PRINCIPLE_CELLS) as FairPrinciple[]).map(principle => (
                    <tbody key={principle}>
                    <tr>
                        <th scope="colgroup" colSpan={assessors.length + 1}
                            className="pt-3 pb-1 text-xs font-semibold text-gray-700">
                            {PRINCIPLE_NAMES[principle]}
                            <span className="ml-2 font-normal text-gray-500">{PRINCIPLE_BLURBS[principle]}</span>
                        </th>
                    </tr>
                    {PRINCIPLE_CELLS[principle].map(cell => {
                        const result = byCell.get(cell);
                        const derived = DERIVED_CELLS.includes(cell);
                        return (
                            <tr key={cell} className="border-b border-gray-100 align-top">
                                <th scope="row" className="py-1.5 pr-3 font-normal">
                                    <span className="mr-1.5 text-xs font-semibold tabular-nums text-gray-700">
                                        {cellLabel(cell)}
                                    </span>
                                    <span className="text-xs font-light text-gray-700">
                                        &ldquo;{CELL_PRINCIPLES[cell]}&rdquo;
                                    </span>
                                    {derived && (
                                        <span className="ml-1.5 text-[11px] text-gray-400">
                                            summary of the rows below, not scored separately
                                        </span>
                                    )}
                                    <span className="mt-0.5 block text-[11px] font-light text-gray-500">
                                        {CELL_PLAIN[cell]}
                                    </span>
                                </th>
                                {assessors.map(assessor => (
                                    <td key={assessor} className="py-1.5 pr-2 whitespace-nowrap">
                                        <OutcomeChip outcome={result?.by_assessor[assessor] ?? 'indeterminate'}/>
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                    </tbody>
                ))}
            </table>
        </div>
    );
};

/** Every individual check an assessor ran, passes included. */
const ChecksList = ({guidance}: { guidance: FairGuidance[] }) => {
    const ordered = [...guidance].sort(
        (a, b) => OUTCOME_ORDER.indexOf(a.outcome) - OUTCOME_ORDER.indexOf(b.outcome),
    );

    return (
        <ul className="flex flex-col gap-2">
            {ordered.map((entry, index) => (
                <li key={`${entry.assessor}-${entry.test}-${index}`}
                    className="rounded-lg border border-gray-200 p-2.5">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <OutcomeChip outcome={entry.outcome}/>
                        {entry.cell && (
                            <span className="text-xs font-semibold tabular-nums text-gray-700">
                                {cellLabel(entry.cell)}
                            </span>
                        )}
                        <span className="text-xs text-gray-500">{assessorName(entry.assessor)}</span>
                        {entry.test && (
                            <code className="text-[11px] text-gray-400">{entry.test}</code>
                        )}
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

const Report = ({report, assessment}: { report: FairReport; assessment: Assessment | null }) => {
    const [issuesOnly, setIssuesOnly] = useState(false);
    const assessors = Object.keys(report.scores) as AssessorId[];
    const issues = report.guidance.filter(e => e.outcome !== 'pass');
    const shown = issuesOnly ? issues : report.guidance;

    return (
        <div className="flex flex-col gap-5">
            <Provenance assessment={assessment} report={report}/>

            {assessors.length === 0 ? (
                <p className="text-sm font-light text-gray-500">
                    No assessor returned a score for this dataset.
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {assessors.map(assessor => {
                        const scores = report.scores[assessor];
                        return scores
                            ? <AssessorScores key={assessor} assessor={assessor} scores={scores} cells={report.cells}/>
                            : null;
                    })}
                    <p className="text-xs font-light text-gray-500">
                        Each assessor is reported on its own. They apply the principles differently and
                        often disagree, so a single combined grade would hide where they part company.
                    </p>
                </div>
            )}

            <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-gray-800">The 15 FAIR criteria</h3>
                <CriteriaTable cells={report.cells} assessors={assessors}/>
                <p className="text-xs font-light text-gray-500">
                    Each criterion is quoted from the FAIR Guiding Principles (Wilkinson et al., 2016),
                    as published by the{' '}
                    <a
                        href={FAIR_PRINCIPLES_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 underline"
                    >
                        GO FAIR Foundation
                    </a>
                    . The line beneath each one is our plain-language reading of it, not part of the standard.
                </p>
            </section>

            <section className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-800">
                        Every check that was run
                        <span className="ml-1.5 font-normal text-gray-500">
                            ({report.guidance.length} checks, {issues.length} not passing)
                        </span>
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs font-light text-gray-600">
                        <input
                            type="checkbox"
                            checked={issuesOnly}
                            onChange={event => setIssuesOnly(event.target.checked)}
                            className="cursor-pointer"
                        />
                        Only show what did not pass
                    </label>
                </div>
                {shown.length === 0 ? (
                    <p className="text-sm font-light text-gray-500">Every check passed.</p>
                ) : (
                    <ChecksList guidance={shown}/>
                )}
            </section>
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
 * Everything the assessors reported is on the page: all 15 criteria, every check
 * including the ones that passed, and the provenance of the run. A report about
 * openness that had to be unfolded to be read would be a poor advertisement for it.
 *
 * The one thing deferred is the assessment itself, which takes ~35s with a DOI and
 * minutes without one. Mount looks for a finished run and otherwise waits to be asked.
 */
export const FairAssessmentCard = ({pid}: FairAssessmentCardProps) => {
    const {state, report, assessment, error, finishedAssessors, plannedAssessors, fromCache, isDoiPid, run} =
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

            <p className="text-sm font-light text-gray-600">
                How far this dataset follows the{' '}
                <a
                    href={FAIR_PRINCIPLES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline"
                >
                    FAIR principles
                </a>
                : whether it is Findable, Accessible, Interoperable and Reusable. Two independent
                assessors judge it, and both are reported in full below.
            </p>

            {!isDoiPid && (
                <p className="text-sm font-light text-gray-500">
                    This dataset has no DOI, so only F-UJI can assess it. FAIR Champion
                    needs a resolvable identifier and would report nothing here.
                </p>
            )}

            {state === 'checking' && (
                <p className="text-sm font-light text-gray-500">Looking for an existing assessment...</p>
            )}

            {state === 'idle' && (
                <div className="flex flex-col gap-3 items-start">
                    <p className="text-sm font-light text-gray-500">
                        This dataset has not been assessed yet. Running{' '}
                        {plannedAssessors.map(assessorName).join(' and ')} usually takes under a minute.
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
                            ? `Waiting for ${pending.map(assessorName).join(' and ')}...`
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
                            One assessor did not finish, so this covers only the one that did.
                        </p>
                    )}
                    {fromCache && (
                        <p className="text-xs font-light text-gray-500">
                            Showing an earlier assessment of this dataset. Use Re-check to run it again.
                        </p>
                    )}
                    <Report report={report} assessment={assessment}/>
                </>
            )}
        </div>
    );
};
