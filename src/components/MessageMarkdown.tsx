import {Fragment, JSX, useMemo} from "react";
import type {BackendDataset} from "../types/commons.ts";
import {lookupDataset, type DatasetCitation} from "../lib/datasetCitations.ts";
import {sanitizeLinkHref, trimTrailingPartialLink} from "../lib/utils.ts";
import {DatasetReference} from "./DatasetReference.tsx";

interface MessageMarkdownProps {
    text: string;
    // Datasets citable in this thread, keyed by normalized URL (see buildDatasetUrlMap).
    datasets: Map<string, BackendDataset>;
    // True while this text is still streaming in.
    streaming?: boolean;
    // The message's numbered citations (see collectCitations); a link to a cited
    // dataset gets its [n] marker. Without them a matched link is a bare pill.
    citations?: DatasetCitation[];
    // Called with the reference number when a [n] marker is activated.
    onCite?: (number: number) => void;
}

/**
 * A table is a header row, a delimiter row that fixes each column's alignment, and the
 * body rows under it: `| a | b |` over `|---|---:|`. Both outer pipes are required and
 * the delimiter row is mandatory, so an ordinary sentence containing a pipe is never
 * mistaken for a table.
 */
const TABLE_ROW = /^\|.*\|$/;
const TABLE_DELIMITER = /^\|(?:\s*:?-+:?\s*\|)+$/;

type CellAlignment = 'left' | 'center' | 'right';

const ALIGNMENT_CLASS: Record<CellAlignment, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

/** Splits `| a | b |` into its cells, honouring a `\|` escaped pipe inside one. */
const splitRow = (line: string): string[] => {
    const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    const cells: string[] = [];
    let cell = '';
    for (let i = 0; i < body.length; i++) {
        if (body[i] === '\\' && body[i + 1] === '|') {
            cell += '|';
            i++;
        } else if (body[i] === '|') {
            cells.push(cell);
            cell = '';
        } else {
            cell += body[i];
        }
    }
    cells.push(cell);
    return cells.map(text => text.trim());
};

/** Reads `|:--|:-:|--:|` as the column alignments it declares. */
const parseAlignments = (delimiter: string): CellAlignment[] =>
    splitRow(delimiter).map(cell => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        return cell.endsWith(':') ? 'right' : 'left';
    });

/**
 * Renders the subset of Markdown the assistant produces: tables, links, bold, italic,
 * inline code, headings, rules, and ordered/unordered list lines. A link pointing at one
 * of the thread's search hits becomes a numbered dataset citation; any other link stays
 * an ordinary external link. Anything outside that subset is left as the literal text
 * the model wrote, so an unsupported construct reads as plain prose rather than breaking.
 */
export const MessageMarkdown = ({text, datasets, streaming = false, citations = [], onCite}: MessageMarkdownProps) => {
    const numbers = useMemo(
        () => new Map(citations.map(citation => [citation.dataset, citation.number])),
        [citations]
    );

    const renderInline = (line: string, keyPrefix: string) => {
        // Handles `code`, **[label](url)**, [label](url), **bold** and *italic* in a
        // single pass. `**` is tried before `*` so bold never reads as empty italics.
        // Italics are deliberately limited to `*word*`: `_word_` would mangle the
        // identifiers this chat is full of (total_precipitation, ERA5_Land, …).
        const tokenRegex = /`([^`]+)`|\*\*\[(.+?)]\((.+?)\)\*\*|\[(.+?)]\((.+?)\)|\*\*(.+?)\*\*|\*([^\s*](?:[^*]*[^\s*])?)\*/g;
        const nodes: (string | JSX.Element)[] = [];
        let lastIndex = 0;
        let tokenIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = tokenRegex.exec(line)) !== null) {
            if (match.index > lastIndex) {
                nodes.push(line.substring(lastIndex, match.index));
            }

            const [fullMatch, codeText, boldLinkText, boldLinkHref, linkText, linkHref, boldText, italicText] = match;
            const label = boldLinkText || linkText;
            const href = boldLinkHref || linkHref;
            if (codeText) {
                nodes.push(
                    <code
                        key={`md-${keyPrefix}-${tokenIndex++}`}
                        className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] text-gray-800"
                    >
                        {codeText}
                    </code>
                );
            } else if (label && href) {
                const safeHref = sanitizeLinkHref(href);
                if (!safeHref) {
                    nodes.push(label);
                    lastIndex = match.index + fullMatch.length;
                    continue;
                }
                const dataset = lookupDataset(datasets, safeHref);
                nodes.push(dataset ? (
                    <DatasetReference
                        key={`md-${keyPrefix}-${tokenIndex++}`}
                        dataset={dataset}
                        label={label}
                        number={numbers.get(dataset)}
                        onJump={onCite}
                    />
                ) : (
                    <a
                        key={`md-${keyPrefix}-${tokenIndex++}`}
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-blue-500 hover:text-blue-700 underline break-all ${boldLinkText ? 'font-semibold' : 'font-medium'}`}
                    >
                        {label}
                    </a>
                ));
            } else if (boldText) {
                nodes.push(
                    <strong key={`md-${keyPrefix}-${tokenIndex++}`} className="font-semibold text-gray-900">
                        {boldText}
                    </strong>
                );
            } else if (italicText) {
                nodes.push(
                    <em key={`md-${keyPrefix}-${tokenIndex++}`} className="italic">
                        {italicText}
                    </em>
                );
            } else {
                nodes.push(fullMatch);
            }

            lastIndex = match.index + fullMatch.length;
        }

        if (lastIndex < line.length) {
            nodes.push(line.substring(lastIndex));
        }

        return nodes.map((node, idx) => <Fragment key={`md-frag-${keyPrefix}-${idx}`}>{node}</Fragment>);
    };

    // Every line becomes its own `min-h-6` paragraph below, so a raw blank line is
    // 24px of empty space. The agent pads its text with newlines around tool calls,
    // which stacked up into large gaps; collapse a run of blanks to the single break
    // it means and drop the padding at the edges, leaving the block spacing to the caller.
    const content = (streaming ? trimTrailingPartialLink(text) : text)
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\n+|\n+$/g, '');

    const renderParagraph = (rawLine: string, index: number) => {
        const trimmedLeft = rawLine.trimStart();

        // A run of dashes, asterisks or underscores on its own line is a section break.
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmedLeft.trimEnd())) {
            return <hr key={index} className="my-3 border-gray-200"/>;
        }

        // Headings stay <p>: the levels the model picks are arbitrary and would pollute
        // the page's outline, so they are styled rather than promoted to real headings.
        const headingMatch = trimmedLeft.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            return (
                <p
                    key={index}
                    className={`leading-relaxed mt-3 first:mt-0 font-semibold text-gray-900 ${level <= 2 ? 'text-base' : ''}`}
                >
                    {renderInline(headingMatch[2], `${index}`)}
                </p>
            );
        }

        const orderedMatch = trimmedLeft.match(/^(\d+)\.\s+(.*)$/);
        const unorderedMatch = trimmedLeft.match(/^[*-]\s+(.*)$/);
        const lineBody = orderedMatch?.[2] ?? unorderedMatch?.[1] ?? rawLine;

        const isMetadata =
            trimmedLeft.startsWith('**Creator:**') ||
            trimmedLeft.startsWith('**Published:**') ||
            trimmedLeft.startsWith('**Description:**');

        return (
            <p key={index} className={`leading-relaxed min-h-6 ${isMetadata ? 'text-gray-700 text-sm mt-1' : ''}`}>
                {orderedMatch ? <span className="mr-2 font-medium text-gray-700">{orderedMatch[1]}.</span> : null}
                {unorderedMatch ? <span className="mr-2 text-gray-500">•</span> : null}
                {renderInline(lineBody, `${index}`)}
            </p>
        );
    };

    const renderTable = (header: string[], alignments: CellAlignment[], rows: string[][], index: number) => {
        // Ragged rows are common: render the widest row's worth of columns and pad the
        // rest, so a missing cell leaves a gap instead of shifting the row's columns.
        const columnCount = Math.max(header.length, ...rows.map(row => row.length));
        const columns = Array.from({length: columnCount}, (_, column) => column);
        const cellClass = (column: number) =>
            `px-3 py-2 align-top break-words ${ALIGNMENT_CLASS[alignments[column] ?? 'left']}`;

        // The bubble is `whitespace-pre-wrap`, which cells must not inherit, and it caps
        // the width: let the table wrap to fit, and scroll only when it cannot.
        return (
            <div key={index} className="my-2 overflow-x-auto">
                <table className="w-full min-w-[32rem] table-auto border-collapse whitespace-normal text-sm">
                    <thead>
                    <tr className="border-b border-gray-300 bg-gray-50">
                        {columns.map(column => (
                            <th key={column} className={`${cellClass(column)} font-semibold text-gray-900`}>
                                {renderInline(header[column] ?? '', `${index}-h${column}`)}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-gray-200 last:border-b-0">
                            {columns.map(column => (
                                <td key={column} className={`${cellClass(column)} text-gray-700`}>
                                    {renderInline(row[column] ?? '', `${index}-r${rowIndex}c${column}`)}
                                </td>
                            ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const lines = content.split('\n');
    const blocks: JSX.Element[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // A table only starts where the delimiter row confirms it. While the answer is
        // still streaming the header arrives first and reads as text for a moment, then
        // snaps into the table as soon as the delimiter lands.
        if (TABLE_ROW.test(line) && TABLE_DELIMITER.test(lines[i + 1]?.trim() ?? '')) {
            const header = splitRow(line);
            const alignments = parseAlignments(lines[i + 1].trim());
            const rows: string[][] = [];
            let end = i + 2;
            while (end < lines.length && TABLE_ROW.test(lines[end].trim())) {
                rows.push(splitRow(lines[end].trim()));
                end++;
            }
            blocks.push(renderTable(header, alignments, rows, i));
            i = end - 1;
            continue;
        }
        blocks.push(renderParagraph(lines[i], i));
    }

    return <>{blocks}</>;
};
