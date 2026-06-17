import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {LoaderIcon, X} from 'lucide-react';
import {FileMeta} from '@/types/dataplayerTypes';
import {fetchTextPreview, filePreviewUrl} from '@/lib/coordinatorApi';
import {CSV_PREVIEW_ROWS, getPreviewKind, parseCsvRows} from '@/lib/filePreview';

interface FilePreviewModalProps {
    file: FileMeta;
    onClose: () => void;
}

/** strip the leading "__ROOT__/" so the header shows a clean filename */
const displayName = (file: FileMeta) => {
    const parts = file.dataPath.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? file.filename;
};

export const FilePreviewModal = ({file, onClose}: FilePreviewModalProps) => {
    const kind = getPreviewKind(file);
    const downloadUrl = file.downloadUrl ?? '';

    const [text, setText] = useState<string | null>(null);
    const [truncated, setTruncated] = useState(false);
    const [loading, setLoading] = useState(kind === 'text' || kind === 'csv');
    const [error, setError] = useState<string | null>(null);

    // close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    // fetch text/csv content via the proxy. The modal is remounted per file
    // (keyed by dataPath in FileTree), so initial state is already correct —
    // we only update state from the async callbacks below.
    useEffect(() => {
        if (kind !== 'text' && kind !== 'csv') return;
        let cancelled = false;

        fetchTextPreview(downloadUrl)
            .then(({text, truncated}) => {
                if (cancelled) return;
                setText(text);
                setTruncated(truncated);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load preview');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [downloadUrl, kind]);

    const csv = useMemo(() => {
        if (kind !== 'csv' || text == null) return null;
        return parseCsvRows(text, CSV_PREVIEW_ROWS + 1);
    }, [kind, text]);

    const body = (() => {
        if (loading) {
            return (
                <div className="flex items-center gap-3 p-8 justify-center">
                    <LoaderIcon className="h-5 w-5 text-eosc-light-blue animate-spin shrink-0"/>
                    <p className="text-sm font-light text-eosc-text">Loading preview…</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="m-4 p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600 font-light">{error}</p>
                </div>
            );
        }

        if (kind === 'image') {
            return (
                <div className="p-4 flex justify-center bg-gray-50">
                    <img
                        src={filePreviewUrl(downloadUrl, 'binary')}
                        alt={displayName(file)}
                        className="max-w-full max-h-[70vh] object-contain"
                    />
                </div>
            );
        }

        if (kind === 'pdf') {
            return (
                <iframe
                    src={filePreviewUrl(downloadUrl, 'binary')}
                    title={displayName(file)}
                    className="w-full h-[70vh] border-0"
                />
            );
        }

        if (kind === 'csv' && csv) {
            const [header, ...rows] = csv.rows;
            return (
                <div className="overflow-auto max-h-[70vh]">
                    <table className="w-full text-sm border-collapse">
                        {header && (
                            <thead className="sticky top-0 bg-gray-50">
                            <tr>
                                {header.map((cell, i) => (
                                    <th
                                        key={i}
                                        className="text-left font-medium text-eosc-text px-3 py-2 border-b border-eosc-border whitespace-nowrap"
                                    >
                                        {cell}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                        )}
                        <tbody>
                        {rows.map((row, r) => (
                            <tr key={r} className="hover:bg-gray-50">
                                {row.map((cell, c) => (
                                    <td
                                        key={c}
                                        className="px-3 py-1.5 border-b border-eosc-border text-eosc-text font-light whitespace-nowrap"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        // plain text
        return (
            <pre
                className="text-xs text-eosc-text font-mono whitespace-pre-wrap break-words p-4 max-h-[70vh] overflow-auto m-0">
                {text}
            </pre>
        );
    })();

    const showTruncationNote =
        (kind === 'text' && truncated) ||
        (kind === 'csv' && (csv?.hasMore || truncated));

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl border border-eosc-border w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* header */}
                <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-eosc-border">
                    <h3 className="text-sm font-light text-eosc-text break-all min-w-0" title={displayName(file)}>
                        {displayName(file)}
                    </h3>
                    <div className="flex items-center gap-3 shrink-0">
                        {file.size && (
                            <span
                                className="text-[#646363] px-2 py-1 bg-gray-50 border border-eosc-border rounded text-xs font-light">
                                {file.size}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close preview"
                            className="text-eosc-gray hover:text-eosc-text transition-colors cursor-pointer"
                        >
                            <X className="h-5 w-5"/>
                        </button>
                    </div>
                </div>

                {/* body */}
                <div className="flex-1 overflow-auto min-h-0">{body}</div>

                {/* footer */}
                <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-eosc-border">
                    <p className="text-xs text-eosc-gray font-light">
                        {showTruncationNote ? 'Preview truncated — download for the full file.' : 'Preview'}
                    </p>
                    {downloadUrl && (
                        <button
                            type="button"
                            onClick={() => window.open(downloadUrl, '_blank')}
                            className="text-eosc-light-blue hover:text-blue-500 font-light transition-colors border border-eosc-light-blue hover:border-eosc-dark-blue px-3 py-1.5 rounded-md text-sm bg-white hover:bg-gray-50 cursor-pointer"
                        >
                            Download
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
};
