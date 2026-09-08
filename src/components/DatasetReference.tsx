import {FileText} from "lucide-react";
import type {BackendDataset} from "../types/commons.ts";
import {getProvenanceSource} from "../lib/repoProvenance.ts";
import useMatomo from "../hooks/useMatomo";

interface DatasetReferenceProps {
    // The dataset this citation resolved to (matched on the link's href).
    dataset: BackendDataset;
    // Link text chosen by the model (e.g. "Global Carbon Budget"); falls back to the dataset title.
    label?: string;
    // Position in the message's reference list. Omitted when the message has no list.
    number?: number;
    // Called with the reference number when the [n] marker is activated.
    onJump?: (number: number) => void;
}

/**
 * Inline citation of a dataset from the search results, in the style of a numbered
 * reference. The dataset name is a pill that links straight to the source, so a plain
 * click opens it and a modifier-click opens it in a background tab; the pill names the
 * repository the data comes from. The bracketed [n] in front of it jumps to the
 * dataset's entry in the message's reference list, where the card details and
 * actions live; leading with the number is what pairs the pill with that entry.
 * Nothing opens on hover.
 */
export const DatasetReference = ({dataset, label, number, onJump}: DatasetReferenceProps) => {
    const {trackEvent} = useMatomo();

    const title = dataset.title || dataset._source?.titles?.[0]?.title || 'dataset';
    const href = dataset.dataset_url || dataset._id;
    const source = getProvenanceSource(dataset);
    const reference = number === undefined
        ? null
        : `Reference ${number}: ${title}${source ? ` (${source.name})` : ''}`;

    return (
        <>
            {reference && (
                <button
                    type="button"
                    onClick={() => {
                        trackEvent('Chat', 'citation_marker_clicked');
                        onJump?.(number!);
                    }}
                    title={reference}
                    aria-label={reference}
                    className="mr-0.5 rounded px-0.5 text-[13px] font-semibold text-blue-700 tabular-nums whitespace-nowrap hover:bg-blue-50 hover:underline cursor-pointer"
                >
                    [{number}]
                </button>
            )}
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={title}
                onClick={() => trackEvent('Dataset', 'citation_source_clicked', title)}
                // Inline (not inline-flex) so a long title wraps across lines with the text;
                // box-decoration-clone keeps the pill background/border on every wrapped line.
                className="mx-0.5 rounded bg-blue-50 px-1.5 py-px text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors [box-decoration-break:clone]"
            >
                <FileText className="inline-block h-3 w-3 mr-1 align-[-0.125em]"/>
                {label || title}
                {source && (
                    <span className="ml-1.5 border-l border-blue-200 pl-1.5 font-normal text-gray-500">
                        {source.name}
                    </span>
                )}
            </a>
        </>
    );
};
