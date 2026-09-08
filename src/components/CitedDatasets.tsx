import {useEffect, useRef, useState} from "react";
import {ChevronDown, ChevronUp} from "lucide-react";
import type {DatasetCitation} from "../lib/datasetCitations.ts";
import type {SearchHitSrcCreator} from "../types/commons.ts";
import {getProvenanceSource, type RepoIdentity} from "../lib/repoProvenance.ts";
import {publicationDateOf} from "../lib/utils.ts";
import {RepoProvenance} from "./RepoProvenance.tsx";
import {DatasetActions, DatasetDetails, RelevanceBadge} from "./SearchResultItem.tsx";

/** One activation of a [n] marker; `seq` distinguishes repeated clicks on the same number. */
export interface JumpRequest {
    number: number;
    seq: number;
}

interface CitedDatasetsProps {
    citations: DatasetCitation[];
    isLoggedIn?: boolean;
    jump?: JumpRequest | null;
}

/**
 * How many of the cited datasets come from each repository, most first. Names only:
 * the logos stay on the rows, where they have the room to be recognisable.
 */
const CitedFromStrip = ({citations}: { citations: DatasetCitation[] }) => {
    const counts = new Map<string, { source: RepoIdentity; count: number }>();
    for (const {dataset} of citations) {
        const source = getProvenanceSource(dataset);
        if (!source) continue;
        const entry = counts.get(source.code) ?? {source, count: 0};
        entry.count += 1;
        counts.set(source.code, entry);
    }
    if (counts.size === 0) return null;

    const items = [...counts.values()].sort((a, b) => b.count - a.count);
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wide">Cited from</span>
            {items.map(({source, count}) => (
                <span
                    key={source.code}
                    title={`${count} of ${citations.length} cited datasets from ${source.name}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5"
                >
                    <span className="font-semibold text-gray-700">{source.name}</span>
                    <span className="tabular-nums">{count}</span>
                </span>
            ))}
        </div>
    );
};

interface CitedDatasetRowProps {
    citation: DatasetCitation;
    isLoggedIn: boolean;
    highlighted: boolean;
    register: (number: number, element: HTMLLIElement | null) => void;
}

/** A compact reference entry; the chevron expands it into the full card details. */
const CitedDatasetRow = ({citation, isLoggedIn, highlighted, register}: CitedDatasetRowProps) => {
    const [expanded, setExpanded] = useState(false);
    const {number, dataset} = citation;

    const creators: SearchHitSrcCreator[] = dataset._source.creators ?? [];
    const year = publicationDateOf(dataset)?.slice(0, 4);
    const byline = creators.slice(0, 2).map(c => c.creatorName).join(', ')
        + (creators.length > 2 ? `, +${creators.length - 2} more` : '');
    const meta = [year, byline].filter(Boolean).join(' · ');

    return (
        <li
            ref={element => register(number, element)}
            tabIndex={-1}
            className={`grid grid-cols-[36px_minmax(0,1fr)] sm:grid-cols-[36px_96px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 px-3 py-2.5 border-t border-gray-100 first:border-t-0 transition-colors duration-700 ${highlighted ? 'bg-blue-100' : 'bg-transparent'}`}
        >
            <span className="text-[13px] font-semibold text-blue-700 tabular-nums whitespace-nowrap"
                  aria-label={`Reference ${number}`}>
                [{number}]
            </span>
            <span className="flex items-center min-w-0">
                <RepoProvenance hit={dataset}/>
            </span>
            <div className="col-start-2 sm:col-start-3 min-w-0 flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-gray-900 leading-snug break-words">{dataset.title}</span>
                {meta && <span className="text-xs text-gray-500 break-words">{meta}</span>}
            </div>
            <div className="col-start-2 sm:col-start-4 flex flex-wrap items-center gap-2">
                <DatasetActions hit={dataset} isLoggedIn={isLoggedIn} compact/>
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    aria-expanded={expanded}
                    aria-label={expanded ? `Hide details of ${dataset.title}` : `Show details of ${dataset.title}`}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer transition-transform ${expanded ? 'rotate-180' : ''}`}
                >
                    <ChevronDown className="h-4 w-4"/>
                </button>
            </div>
            {expanded && (
                <div className="col-span-full sm:pl-40 pt-1 text-sm">
                    <div className="flex mb-3"><RelevanceBadge hit={dataset}/></div>
                    <DatasetDetails hit={dataset}/>
                </div>
            )}
        </li>
    );
};

/**
 * The reference list under an assistant answer: every dataset the answer cites, in
 * the order of its [n] markers, as compact rows with the card's actions. A `jump`
 * request from a marker scrolls its row into view and highlights it briefly, opening
 * the list first if the reader had hidden it.
 */
export const CitedDatasets = ({citations, isLoggedIn = false, jump = null}: CitedDatasetsProps) => {
    // The list is open unless the reader hid it, and a marker clicked after that
    // reopens it: `hiddenAt` remembers which jump was current when it was hidden.
    const [hiddenAt, setHiddenAt] = useState<number | null>(null);
    // The jump whose highlight has already faded.
    const [fadedJump, setFadedJump] = useState(0);
    const rows = useRef(new Map<number, HTMLLIElement>());

    const open = hiddenAt === null || (jump !== null && jump.seq > hiddenAt);
    const highlighted = jump !== null && jump.seq > fadedJump ? jump.number : null;

    useEffect(() => {
        if (!jump) return;
        const row = rows.current.get(jump.number);
        const reduceMotion = typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        row?.scrollIntoView?.({behavior: reduceMotion ? 'auto' : 'smooth', block: 'center'});
        row?.focus({preventScroll: true});
        const timer = setTimeout(() => setFadedJump(jump.seq), 1500);
        return () => clearTimeout(timer);
    }, [jump]);

    if (citations.length === 0) return null;

    const register = (number: number, element: HTMLLIElement | null) => {
        if (element) rows.current.set(number, element);
        else rows.current.delete(number);
    };

    return (
        <section aria-label="Datasets cited in this answer"
                 className="whitespace-normal border-t border-gray-200 pt-3.5 flex flex-col gap-3">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    Datasets cited in this answer
                    <span
                        className="rounded-full border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700 tabular-nums">
                        {citations.length}
                    </span>
                </h4>
                <button
                    type="button"
                    onClick={() => setHiddenAt(open ? (jump?.seq ?? 0) : null)}
                    aria-expanded={open}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-blue-600 hover:bg-blue-50 cursor-pointer"
                >
                    {open
                        ? <><ChevronUp className="h-3.5 w-3.5"/>Hide list</>
                        : <><ChevronDown className="h-3.5 w-3.5"/>Show all {citations.length}</>}
                </button>
            </header>

            <CitedFromStrip citations={citations}/>

            {open && (
                <ol className="list-none m-0 p-0 rounded-lg border border-gray-200 bg-white overflow-hidden">
                    {citations.map(citation => (
                        <CitedDatasetRow
                            key={citation.dataset.dataset_url ?? citation.dataset._id}
                            citation={citation}
                            isLoggedIn={isLoggedIn}
                            highlighted={highlighted === citation.number}
                            register={register}
                        />
                    ))}
                </ol>
            )}
        </section>
    );
};

