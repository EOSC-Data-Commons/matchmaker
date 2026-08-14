import {useRef, useState} from "react";
import {FileText} from "lucide-react";
import type {BackendDataset} from "../types/commons.ts";
import {SearchResultItem} from "./SearchResultItem.tsx";

interface DatasetReferenceProps {
    // The dataset this citation resolved to (matched on the link's href).
    dataset: BackendDataset;
    // Link text chosen by the model (e.g. "Global Carbon Budget"); falls back to the dataset title.
    label?: string;
    isLoggedIn?: boolean;
}

/**
 * Inline citation-style reference to a dataset from the search results.
 * Renders a small interactive chip; hovering or clicking reveals the dataset card.
 */
export const DatasetReference = ({dataset, label, isLoggedIn = false}: DatasetReferenceProps) => {
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelClose = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    const scheduleClose = () => {
        cancelClose();
        closeTimer.current = setTimeout(() => setOpen(false), 150);
    };

    const title = dataset.title || dataset._source?.titles?.[0]?.title || 'dataset';
    const chipText = label || title;
    const visible = open || pinned;

    return (
        <span className="relative">
            <span
                role="button"
                tabIndex={0}
                onClick={() => {
                    setPinned(p => !p);
                    setOpen(true);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setPinned(p => !p);
                        setOpen(true);
                    }
                }}
                onMouseEnter={() => {
                    cancelClose();
                    setOpen(true);
                }}
                onMouseLeave={scheduleClose}
                title={title}
                // Inline (not inline-flex) so a long title wraps across lines with the text;
                // box-decoration-clone keeps the pill background/border on every wrapped line.
                className="mx-0.5 rounded bg-blue-50 px-1.5 py-px text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer [box-decoration-break:clone]"
            >
                <FileText className="inline-block h-3 w-3 mr-1 align-[-0.125em]"/>
                {chipText}
            </span>

            {visible && (
                <div
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                    className="absolute z-30 left-0 top-full mt-1 w-[min(90vw,480px)] text-left"
                    role="dialog"
                >
                    <SearchResultItem hit={dataset} isLoggedIn={isLoggedIn}/>
                </div>
            )}
        </span>
    );
};
