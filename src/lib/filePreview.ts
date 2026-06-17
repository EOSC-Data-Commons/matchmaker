import {FileMeta} from '@/types/dataplayerTypes';

export type PreviewKind = 'text' | 'csv' | 'pdf' | 'image' | 'none';

/** number of data rows (excluding the header) shown in a CSV preview */
export const CSV_PREVIEW_ROWS = 20;

const TEXT_EXTENSIONS = new Set([
    'txt', 'sps', 'json', 'md', 'log', 'tsv', 'xml', 'yaml', 'yml', 'r', 'py', 'do', 'sql', 'ini', 'cfg',
]);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

const extensionOf = (name: string): string => {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/**
 * Decide how a file should be previewed, preferring the server mimetype and
 * falling back to the filename extension (the two don't always agree).
 */
export const getPreviewKind = (file: FileMeta): PreviewKind => {
    const mime = (file.mimetype ?? '').toLowerCase();
    const ext = extensionOf(file.filename);

    if (mime === 'text/csv' || ext === 'csv') return 'csv';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return 'image';
    if (
        mime.startsWith('text/') ||
        mime === 'application/json' ||
        mime === 'application/x-spss-syntax' ||
        TEXT_EXTENSIONS.has(ext)
    ) {
        return 'text';
    }
    return 'none';
};

export const isPreviewable = (file: FileMeta): boolean =>
    !!file.downloadUrl && getPreviewKind(file) !== 'none';

/** Guess the column separator from the first line — Dataverse NL data is often ';'-delimited. */
const sniffDelimiter = (sample: string): string => {
    const firstLine = sample.split(/\r?\n/, 1)[0] ?? '';
    const counts: Record<string, number> = {',': 0, ';': 0, '\t': 0};
    let inQuotes = false;
    for (const ch of firstLine) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (!inQuotes && ch in counts) counts[ch] += 1;
    }
    const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return count > 0 ? best : ',';
};

/**
 * Minimal quote-aware CSV/TSV parser. Stops after `maxRows` rows so we never
 * materialise a huge file, and reports whether more content was left unread.
 */
export const parseCsvRows = (
    text: string,
    maxRows: number,
): { rows: string[][]; hasMore: boolean; delimiter: string } => {
    const delimiter = sniffDelimiter(text);
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    let i = 0;

    const endField = () => {
        row.push(field);
        field = '';
    };
    const endRow = () => {
        rows.push(row);
        row = [];
    };

    for (; i < text.length && rows.length < maxRows; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
        } else if (ch === delimiter) {
            endField();
        } else if (ch === '\r') {
            // ignore, handled by \n
        } else if (ch === '\n') {
            endField();
            endRow();
        } else {
            field += ch;
        }
    }

    // flush a trailing row that had no final newline
    if (rows.length < maxRows && (field.length > 0 || row.length > 0)) {
        endField();
        endRow();
    }

    return {rows, hasMore: i < text.length, delimiter};
};
