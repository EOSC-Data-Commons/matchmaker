import type {AssessorId, FairCell, FairCellResult, FairPrinciple, FairScores} from '@/types/fairTypes.ts';

/**
 * Reference data and score arithmetic for the FAIR assessment card.
 *
 * The proxy reports a score per principle but not what it was computed from, and the
 * service is fixed for now, so the basis is recomputed here from the cell grid. The
 * rules mirror `reporting.py` exactly (see `recomputeScores`, which the tests check
 * against real service output), so the two cannot drift silently.
 */

export const PRINCIPLE_NAMES: Record<FairPrinciple, string> = {
    f: 'Findable',
    a: 'Accessible',
    i: 'Interoperable',
    r: 'Reusable',
};

/** One plain sentence per principle, for readers who have not met FAIR before. */
export const PRINCIPLE_BLURBS: Record<FairPrinciple, string> = {
    f: 'Can people and machines find this dataset at all?',
    a: 'Once found, can it be retrieved, and on what terms?',
    i: 'Can it be combined with other data, by software as well as people?',
    r: 'Is it documented and licensed well enough for someone else to reuse it?',
};

/** Which criteria belong to each principle, matching the proxy's PRINCIPLE_CELLS. */
export const PRINCIPLE_CELLS: Record<FairPrinciple, FairCell[]> = {
    f: ['f1', 'f2', 'f3', 'f4'],
    a: ['a1', 'a1_1', 'a1_2', 'a2'],
    i: ['i1', 'i2', 'i3'],
    r: ['r1', 'r1_1', 'r1_2', 'r1_3'],
};

/**
 * A1 and R1 are not measured directly: the proxy combines them from their own
 * refinements, so counting them in a score would count those refinements twice.
 * They are still shown, marked as summaries of the rows beneath them.
 */
export const DERIVED_CELLS: FairCell[] = ['a1', 'r1'];

/**
 * The FAIR Guiding Principles, verbatim.
 *
 * Quoted rather than paraphrased on purpose. This service is assessed against these
 * principles by people who know them, and a summary that quietly drops a qualifier
 * (the "and authorisation" in A1.2, say, or the "plurality" in R1) misstates the
 * standard. `CELL_PLAIN` carries the readable gloss instead.
 *
 * Source: Wilkinson et al. (2016), The FAIR Guiding Principles for scientific data
 * management and stewardship, Scientific Data 3:160018, as published at
 * https://www.gofair.foundation/fair-principles
 */
export const CELL_PRINCIPLES: Record<FairCell, string> = {
    f1: '(meta)data are assigned a globally unique and persistent identifier',
    f2: 'data are described with rich metadata (defined by R1 below)',
    f3: 'metadata clearly and explicitly include the identifier of the data they describe',
    f4: '(meta)data are registered or indexed in a searchable resource',
    a1: '(meta)data are retrievable by their identifier using a standardised communications protocol',
    a1_1: 'the protocol is open, free, and universally implementable',
    a1_2: 'the protocol allows for an authentication and authorisation procedure, where necessary',
    a2: 'metadata are accessible, even when the data are no longer available',
    i1: '(meta)data use a formal, accessible, shared, and broadly applicable language for knowledge representation',
    i2: '(meta)data use vocabularies that follow FAIR principles',
    i3: '(meta)data include qualified references to other (meta)data',
    r1: '(meta)data are richly described with a plurality of accurate and relevant attributes',
    r1_1: '(meta)data are released with a clear and accessible data usage license',
    r1_2: '(meta)data are associated with detailed provenance',
    r1_3: '(meta)data meet domain-relevant community standards',
};

/**
 * A plainer reading of each criterion, for depositors meeting FAIR for the first time.
 *
 * Shown alongside the quoted principle, never instead of it, so the standard is always
 * on the page in its own words and this is visibly a gloss rather than the definition.
 */
export const CELL_PLAIN: Record<FairCell, string> = {
    f1: 'The data and its metadata carry an identifier that is unique worldwide and keeps working',
    f2: 'The dataset is described with enough metadata for someone to tell what it is',
    f3: 'The metadata says which dataset it belongs to, by that identifier',
    f4: 'The dataset is listed somewhere people and machines can search',
    a1: 'The identifier can actually be used to fetch the data, over a standard protocol',
    a1_1: 'That protocol is open, free, and something anyone could implement',
    a1_2: 'Where access has to be controlled, the protocol can check who you are and what you may see',
    a2: 'The metadata survive even if the data themselves are withdrawn',
    i1: 'The data and metadata use a formal, shared, widely usable language that software can read',
    i2: 'The vocabularies used are themselves FAIR',
    i3: 'The data and metadata link to related data, saying how they are related',
    r1: 'The data and metadata are described with many accurate, relevant attributes',
    r1_1: 'A clear, accessible licence says what others may do with it',
    r1_2: 'It records where the data came from and how they were produced',
    r1_3: 'It meets the standards its research community expects',
};

/** `a1_1` reads as "A1.1", which is how the FAIR principles are normally written. */
export const cellLabel = (cell: FairCell) => cell.toUpperCase().replace(/_/g, '.');

/** Points the proxy assigns each measurable outcome. */
const POINTS: Record<string, number> = {pass: 100, partial: 50, fail: 0};

/** The criteria of a principle that can contribute to its score. */
export const scorableCells = (principle: FairPrinciple): FairCell[] =>
    PRINCIPLE_CELLS[principle].filter(cell => !DERIVED_CELLS.includes(cell));

export interface ScoreBasis {
    /** Criteria this assessor actually measured. */
    counted: number;
    /** Criteria it could have measured, ignoring the derived summaries. */
    total: number;
}

/**
 * How much evidence sits behind one principle's score.
 *
 * Without this a score of 100% from one measured criterion looks identical to 100%
 * from four, which is the difference between a strong result and a near-empty one.
 */
export function scoreBasis(
    cells: FairCellResult[],
    assessor: AssessorId,
    principle: FairPrinciple,
): ScoreBasis {
    const byCell = new Map(cells.map(cell => [cell.cell, cell]));
    const scorable = scorableCells(principle);
    const counted = scorable.filter(cell => {
        const outcome = byCell.get(cell)?.by_assessor[assessor];
        return outcome !== undefined && outcome in POINTS;
    }).length;

    return {counted, total: scorable.length};
}

/** Total criteria measured by an assessor across all four principles. */
export function totalBasis(cells: FairCellResult[], assessor: AssessorId): ScoreBasis {
    return (Object.keys(PRINCIPLE_NAMES) as FairPrinciple[]).reduce<ScoreBasis>(
        (sum, principle) => {
            const basis = scoreBasis(cells, assessor, principle);
            return {counted: sum.counted + basis.counted, total: sum.total + basis.total};
        },
        {counted: 0, total: 0},
    );
}

/**
 * Recomputes an assessor's scores from the cell grid, using the proxy's own rules.
 *
 * Not used to render anything: the service's numbers are what the card shows. This
 * exists so the tests can prove the basis counts above are derived the same way the
 * service derives its scores, against real service output.
 */
export function recomputeScores(cells: FairCellResult[], assessor: AssessorId): FairScores {
    const byCell = new Map(cells.map(cell => [cell.cell, cell]));
    const scores = {} as FairScores;

    for (const principle of Object.keys(PRINCIPLE_NAMES) as FairPrinciple[]) {
        const points = scorableCells(principle)
            .map(cell => byCell.get(cell)?.by_assessor[assessor])
            .filter((outcome): outcome is string => outcome !== undefined && outcome in POINTS)
            .map(outcome => POINTS[outcome]);

        scores[principle] = points.length
            ? Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 10) / 10
            : null;
    }

    const measured = (Object.keys(PRINCIPLE_NAMES) as FairPrinciple[])
        .map(principle => scores[principle])
        .filter((score): score is number => score !== null);

    scores.overall = measured.length
        ? Math.round((measured.reduce((a, b) => a + b, 0) / measured.length) * 10) / 10
        : null;

    return scores;
}
