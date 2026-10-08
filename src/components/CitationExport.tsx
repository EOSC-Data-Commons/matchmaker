import {useState, useEffect} from 'react';
import * as Popover from '@radix-ui/react-popover';
import type {BackendDataset} from '../types/commons';
import {
    CITATION_STYLES,
    type CitationStyle,
    datasetDOI,
    fetchDOICitation,
    fetchDOIFormattedCitation,
    formatCitation,
    generateBibTeX,
    generateCSLJSON,
    generateRIS
} from '../lib/citation';
import {BookOpenIcon, ClipboardIcon, CheckIcon, DownloadIcon, Loader2Icon} from 'lucide-react';
import useMatomo from '../hooks/useMatomo';

interface CitationExportProps {
    dataset: BackendDataset;
    // Smaller button, to sit in a list row next to Play and Source.
    compact?: boolean;
}

// Reference-manager files, offered after the formatted text styles.
type FileFormat = 'bibtex' | 'ris' | 'csljson';
type CitationFormat = CitationStyle | FileFormat;

const FILE_FORMATS: Record<FileFormat, { label: string; ext: string; mime: string }> = {
    bibtex: {label: 'BibTeX', ext: 'bib', mime: 'application/x-bibtex'},
    ris: {label: 'RIS', ext: 'ris', mime: 'application/x-research-info-systems'},
    csljson: {label: 'CSL JSON', ext: 'json', mime: 'application/vnd.citationstyles.csl+json'}
};

const GENERATORS: Record<FileFormat, (d: BackendDataset) => string> = {
    bibtex: generateBibTeX,
    ris: generateRIS,
    csljson: generateCSLJSON
};

const isFileFormat = (format: CitationFormat): format is FileFormat => format in FILE_FORMATS;

export const CitationExport = ({dataset, compact = false}: CitationExportProps) => {
    const [open, setOpen] = useState(false);
    const [format, setFormat] = useState<CitationFormat>('apa');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [citation, setCitation] = useState<string>('');
    const [usingDOI, setUsingDOI] = useState(false);
    const {trackEvent} = useMatomo();

    // Fetch citation from DOI API or generate locally
    useEffect(() => {
        // A lookup still running when the format changes must not overwrite the newer one.
        let cancelled = false;

        const generateCitation = async () => {
            setLoading(true);
            setUsingDOI(false);

            const doi = datasetDOI(dataset);

            if (doi) {
                const doiCitation = isFileFormat(format)
                    ? await fetchDOICitation(doi, format)
                    : await fetchDOIFormattedCitation(doi, format);
                if (cancelled) return;
                if (doiCitation) {
                    setCitation(doiCitation);
                    setUsingDOI(true);
                    setLoading(false);
                    return;
                }
            }

            // Fallback to local generation if DOI fetch fails or no DOI available
            const localCitation = isFileFormat(format) ? GENERATORS[format](dataset) : formatCitation(dataset, format);
            setCitation(localCitation);
            setUsingDOI(false);
            setLoading(false);
        };

        if (open) {
            generateCitation();
        }
        return () => {
            cancelled = true;
        };
    }, [dataset, format, open]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(citation);
            trackEvent('Citation', 'copied', format);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            if (typeof console !== 'undefined') {
                console.warn('Citation copy failed', err);
            }
        }
    };

    const handleDownload = () => {
        if (!isFileFormat(format)) return;
        trackEvent('Citation', 'downloaded', format);
        const {ext, mime} = FILE_FORMATS[format];
        const blob = new Blob([citation], {type: `${mime};charset=utf-8`});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const safeTitle = dataset.title.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'citation';
        a.download = `${safeTitle}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    };

    return (
        // The panel is portalled to the page body: the lists a Cite button sits in (the
        // chat's cited datasets, a tool call's results) clip their overflow, which cut it
        // off. Radix also flips it to stay on screen, and closes it on Escape or outside clicks.
        <Popover.Root
            open={open}
            onOpenChange={next => {
                setOpen(next);
                if (next) trackEvent('Citation', 'opened', dataset.title);
            }}
        >
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className={`inline-flex items-center justify-center gap-1 rounded-md bg-gray-600 ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} font-medium text-white shadow-sm hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 transition-colors cursor-pointer`}
                >
                    <BookOpenIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}/>
                    <span className="leading-none">Cite</span>
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    aria-label="Export citation"
                    align="end"
                    sideOffset={8}
                    collisionPadding={16}
                    className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-gray-200 bg-white p-3 shadow-lg"
                >
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Export
                        Citation</h4>
                    <label className="flex flex-col gap-1 mb-2 text-xs text-gray-600">
                        Format
                        <select
                            value={format}
                            onChange={e => setFormat(e.target.value as CitationFormat)}
                            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <optgroup label="Formatted text">
                                {(Object.keys(CITATION_STYLES) as CitationStyle[]).map(s => (
                                    <option key={s} value={s}>{CITATION_STYLES[s].label}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Reference manager file">
                                {(Object.keys(FILE_FORMATS) as FileFormat[]).map(f => (
                                    <option key={f} value={f}>{FILE_FORMATS[f].label}</option>
                                ))}
                            </optgroup>
                        </select>
                    </label>
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            type="button"
                            onClick={handleCopy}
                            disabled={loading}
                            aria-label="Copy citation"
                            className="inline-flex items-center rounded bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {copied ? <CheckIcon className="h-3 w-3"/> : <ClipboardIcon className="h-3 w-3"/>}
                            <span className="ml-1">{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                        {/* Formatted text is for pasting; only reference managers import a file. */}
                        {isFileFormat(format) && (
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={loading}
                                aria-label="Download citation file"
                                className="inline-flex items-center rounded bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <DownloadIcon className="h-3 w-3"/>
                                <span className="ml-1">Download</span>
                            </button>
                        )}
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2Icon className="h-6 w-6 text-blue-600 animate-spin"/>
                            <span className="ml-2 text-sm text-gray-600">Loading citation...</span>
                        </div>
                    ) : (
                        <>
                            {isFileFormat(format) ? (
                                <pre
                                    className="max-h-48 overflow-auto text-[11px] leading-snug bg-gray-50 border border-gray-100 rounded p-2 whitespace-pre-wrap text-gray-600 font-mono">{citation}</pre>
                            ) : (
                                <p className="max-h-48 overflow-auto text-xs leading-relaxed bg-gray-50 border border-gray-100 rounded p-2 text-gray-700 break-words">{citation}</p>
                            )}
                            <div className="pt-2 flex items-center justify-between">
                                {usingDOI ? (
                                    <span className="text-[10px] text-green-600 font-medium">
                                        Fetched from official DOI metadata
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-gray-400">
                                        Generated automatically; please verify before use.
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};