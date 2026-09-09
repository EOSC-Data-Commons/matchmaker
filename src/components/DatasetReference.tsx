import type {MouseEvent} from "react";
import {FileText} from "lucide-react";
import type {BackendDataset} from "../types/commons.ts";
import {getProvenanceSource} from "../lib/repoProvenance.ts";
import {sanitizeLinkHref} from "../lib/utils.ts";
import useMatomo from "../hooks/useMatomo";

interface DatasetReferenceProps {
    // The dataset this citation resolved to (matched on the link's href).
    dataset: BackendDataset;
    // Link text chosen by the model (e.g. "Global Carbon Budget"); falls back to the dataset title.
    label?: string;
    // Position in the message's reference list. Omitted when the message has no list.
    number?: number;
    // Called with the reference number when the citation is activated.
    onJump?: (number: number) => void;
}

/**
 * Inline citation of a dataset from the search results, in the style of a numbered
 * reference: one pill carrying [n], the model's label, and the repository the data
 * comes from.
 *
 * The pill is a real link to the dataset's page, so a modifier-click, a middle click
 * and the right-click menu open the source exactly as they would on any link, and
 * several sources can still be opened in a row. A plain click instead cancels that
 * navigation and jumps to the dataset's entry in the message's reference list, which
 * opens expanded — the description, the details and the Source button all live there,
 * so the citation leads to one place rather than two. Nothing opens on hover.
 */
export const DatasetReference = ({dataset, label, number, onJump}: DatasetReferenceProps) => {
    const {trackEvent} = useMatomo();

    const title = dataset.title || dataset._source?.titles?.[0]?.title || 'dataset';
    // Both the URL and the id are backend data, so neither is trusted as a link target.
    const href = sanitizeLinkHref(dataset.dataset_url || dataset._id);
    const source = getProvenanceSource(dataset);
    // Without a number there is no reference list to lead to, so the citation stays
    // an ordinary link to the source.
    const jumpToReference = number === undefined ? null : () => {
        trackEvent('Chat', 'citation_clicked');
        onJump?.(number);
    };

    const description = number === undefined
        ? title
        : `Reference ${number}: ${title}${source ? ` (${source.name})` : ''}`;

    // No aria-label: the accessible name is the visible text, which is what a reader
    // has been told to click. The full title is on the tooltip instead.
    const content = (
        <>
            {number !== undefined && <span className="mr-1 font-semibold tabular-nums">[{number}]</span>}
            <FileText className="inline-block h-3 w-3 mr-1 align-[-0.125em]"/>
            {label || title}
            {source && (
                <span className="ml-1.5 border-l border-blue-200 pl-1.5 font-normal text-gray-500">
                    {source.name}
                </span>
            )}
        </>
    );

    // Inline (not inline-flex) so a long title wraps across lines with the text;
    // box-decoration-clone keeps the pill background/border on every wrapped line.
    const pillClass = 'mx-0.5 rounded bg-blue-50 px-1.5 py-px text-xs font-medium text-blue-700 '
        + 'border border-blue-200 [box-decoration-break:clone]';
    const hoverClass = ' hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer';

    if (!href) {
        // No usable source URL. The citation can still lead to its reference entry;
        // with nothing to lead to either, it just names the dataset.
        return jumpToReference ? (
            <button
                type="button"
                title={description}
                onClick={jumpToReference}
                className={pillClass + hoverClass}
            >
                {content}
            </button>
        ) : (
            <span title={description} className={pillClass}>{content}</span>
        );
    }

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        // A modifier or non-primary click is the reader asking the browser for the
        // source itself (background tab, new window, saved link); leave those alone.
        const opensElsewhere = event.metaKey || event.ctrlKey || event.shiftKey
            || event.altKey || event.button !== 0;
        if (!jumpToReference || opensElsewhere) {
            trackEvent('Dataset', 'citation_source_clicked', title);
            return;
        }
        event.preventDefault();
        jumpToReference();
    };

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={description}
            onClick={handleClick}
            className={pillClass + hoverClass}
        >
            {content}
        </a>
    );
};
