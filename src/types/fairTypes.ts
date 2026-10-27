// Types for the FAIR assessment proxy (dans-labs/fair-assessment-proxy), reached
// through the `/api/fair` proxy in `server.ts`. The service wraps two independent
// assessors, F-UJI and FAIR Champion, and harmonises their output onto one grid of
// 15 FAIR sub-criteria.

/**
 * The assessors that run against a PID and are stored. `GET /assessors/` also lists
 * `offline`, which scores a metadata blob in the request and is never stored, so it
 * never appears in an assessment's results.
 */
export type AssessorId = 'fuji' | 'fair_champion';

/**
 * Outcome of a single FAIR criterion.
 *
 * The proxy's wider enum also contains `error`, `not_applicable` and `unavailable`,
 * but `reporting.outcome_value` collapses anything outside pass/partial/fail to
 * `indeterminate` before it reaches the cell grid, so those three never appear here.
 * They can still appear on a `guidance` entry, which is not passed through that filter.
 */
export type FairOutcome = 'pass' | 'partial' | 'fail' | 'indeterminate';

/** Outcome as it appears on a guidance entry, which keeps the unfiltered vocabulary. */
export type GuidanceOutcome = FairOutcome | 'error' | 'not_applicable' | 'unavailable';

/**
 * The 15 FAIR sub-criteria, in the order the proxy's `CELLS` tuple lists them.
 * `a1` and `r1` may be derived: for an assessor that only tests their refinements
 * (a1_1/a1_2 and r1_1/r1_2/r1_3), the proxy combines them from those and leaves
 * them out of scoring so the refinements are not counted twice. Each result's
 * `derived` says which, since F-UJI tests A1 and R1 directly.
 */
export const FAIR_CELLS = [
    'f1', 'f2', 'f3', 'f4',
    'a1', 'a1_1', 'a1_2', 'a2',
    'i1', 'i2', 'i3',
    'r1', 'r1_1', 'r1_2', 'r1_3',
] as const;

export type FairCell = typeof FAIR_CELLS[number];

/** The four FAIR principles, plus the aggregate the proxy reports alongside them. */
export type FairPrinciple = 'f' | 'a' | 'i' | 'r';

/**
 * Status of an assessment run.
 *
 * `completed_with_errors` means at least one assessor failed while another
 * succeeded, which is common enough to be a normal outcome rather than an
 * error: treat it as done and render whatever results came back.
 */
export type AssessmentStatus =
    | 'queued'
    | 'running'
    | 'completed'
    | 'completed_with_errors'
    | 'failed';

/** An assessment run has finished when it is in one of these states. */
export const TERMINAL_STATUSES: readonly AssessmentStatus[] = [
    'completed',
    'completed_with_errors',
    'failed',
];

/**
 * How the assessors fetch the metadata.
 * `public` resolves the PID on the open web; `cached` reads the OAI-PMH gateway's
 * representation instead. `offline` exists on the proxy's enum but is reached by
 * requesting the `offline` assessor with a metadata blob, not through this field.
 */
export type AssessmentMode = 'public' | 'cached';

export interface CreateAssessmentRequest {
    /** A DOI, with or without the `https://doi.org/` prefix, or a plain URL. */
    pid: string;
    mode?: AssessmentMode;
    /**
     * Reuse a stored result for the same pid+mode+assessor when one exists,
     * instead of re-running the assessor. Copies the stored result onto the new
     * assessment, so the response shape is unchanged either way.
     */
    cached?: boolean;
    /** Defaults to every enabled assessor when omitted. */
    assessors?: AssessorId[];
}

export interface CreateAssessmentResponse {
    id: string;
    status: AssessmentStatus;
}

/**
 * `POST /assessments/` with only the `offline` assessor. Nothing is queued, so there
 * is no id, and the result comes back in the response.
 */
export interface OfflineAssessmentResponse {
    id: null;
    status: 'completed';
    offline: OfflineAssessment;
}

export interface Assessor {
    id: AssessorId | 'offline';
    name: string;
}

/**
 * Per-principle scores, 0 to 100.
 *
 * `null` means nothing was measurable for that principle, which is not the same
 * as scoring zero: F-UJI routinely returns `a: null` because every Accessible
 * criterion came back indeterminate. Render it as "not assessed", never as 0.
 */
export type FairScores = Record<FairPrinciple | 'overall', number | null>;

/** How many criteria actually contributed to each score in `FairScores`. */
export type FairScoredCounts = Record<FairPrinciple | 'overall', number>;

/**
 * One criterion, with each assessor's verdict and the proxy's combined view.
 *
 * `consensus` is pessimistic: the proxy's `combine()` returns `fail` if any
 * assessor failed, even when another passed. The assessors disagree often, so
 * prefer showing `by_assessor` over leading with the consensus.
 */
export interface FairCellResult {
    cell: FairCell;
    consensus: FairOutcome;
    by_assessor: Partial<Record<AssessorId, FairOutcome>>;
}

/**
 * One underlying test, with the reason it reached its outcome. This is the part
 * a user can act on: `message` explains what is wrong and `guidance` (populated
 * by FAIR Champion's algorithm, empty for F-UJI) suggests how to fix it.
 */
export interface FairGuidance {
    assessor: AssessorId;
    /** The criterion this test feeds, or null when the proxy could not map it. */
    cell: FairCell | null;
    /** The assessor's own test id, e.g. "MetadataIdentifierFound" or "FsF-F2-01M". */
    test: string | null;
    description: string | null;
    message: string | null;
    outcome: GuidanceOutcome;
    guidance: string[];
}

/**
 * One assessor's harmonized result: its verdict per criterion, its scores, and every
 * check behind them.
 */
export interface FairAssessorResult<A extends string = AssessorId> {
    assessor: A;
    status: string;
    assessor_version: string;
    profile_ref: string | null;
    error: string | null;
    cells: Record<FairCell, FairOutcome>;
    scores: FairScores;
    /** How many criteria each score was computed from. */
    scored: FairScoredCounts;
    /** Criteria combined from their refinements rather than tested, and left out of `scores`. */
    derived: FairCell[];
    unmapped: unknown[];
    guidance: FairGuidance[];
}

/**
 * `GET /assessments/{id}/results`, the harmonized view across all assessors.
 * An assessor that failed has no entry in `results`.
 */
export interface FairReport {
    id: string;
    pid: string;
    status: AssessmentStatus;
    cells: FairCellResult[];
    results: FairAssessorResult[];
}

/**
 * One assessor's harmonized row, as returned inside an assessment record. Unlike the
 * report's cells these are not filtered, so `not_applicable` and the like do appear.
 */
export interface AssessmentResultRow extends Record<FairCell | FairPrinciple, GuidanceOutcome> {
    assessor: AssessorId;
    assessor_version: string;
}

/** `GET /assessments/{id}`, the run's status and per-assessor outcomes. */
export interface Assessment {
    id: string;
    pid: string;
    mode: AssessmentMode;
    assessors: AssessorId[];
    status: AssessmentStatus;
    created_at: string;
    completed_at: string | null;
    results: AssessmentResultRow[];
}

/** One entry of `GET /assessments/?pid=`, which omits the per-assessor results. */
export interface AssessmentSummary {
    id: string;
    pid: string;
    mode: AssessmentMode;
    assessors: AssessorId[];
    status: AssessmentStatus;
    created_at: string;
    completed_at: string | null;
}

/**
 * The `offline` assessor's result, which scores a metadata blob synchronously and
 * stores nothing. Same shape as a stored result, plus the assessor's complete output.
 */
export interface OfflineAssessment extends FairAssessorResult<'offline'> {
    raw: Record<string, unknown>;
}
