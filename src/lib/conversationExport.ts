import type {Message, MessageBlock, ToolCall} from "@/types/chat.ts";
import type {BackendDataset} from "@/types/commons.ts";
import {
    buildDatasetUrlMap,
    collectCitations,
    normalizeDatasetUrl,
    type DatasetCitation
} from "@/lib/datasetCitations.ts";
import {datasetDOI, formatCitation} from "@/lib/citation.ts";
import {parseDatasetFiles, toolLabel} from "@/lib/toolResults.ts";
import {sanitizeLinkHref} from "@/lib/utils.ts";
import {AI_DISCLAIMER, FUNDING_STATEMENT, LOGO_PATH, SITE_NAME} from "@/lib/branding.ts";

/**
 * Turns an AI Mode conversation into a document someone else can read: a Markdown file,
 * and the parts the printable (PDF) view is built from. Both carry the same content, in
 * the order it appeared on screen: each question, each answer with the tool calls behind
 * it and its numbered dataset citations, and the service's branding around them.
 *
 * Nothing here knows who is signed in. The exporter's name is an option the caller
 * passes, so the same code serves a conversation that has no account behind it.
 */

export interface ExportableConversation {
    title: string;
    messages: Message[];
}

export interface ExportOptions {
    // The site's own address at export time, so a file exported from dev links to dev.
    origin: string;
    exportedAt: Date;
    version: string;
    // Shown as "Exported by …" only when the reader chose to add their name.
    author?: string;
}

/** A bot message's blocks; a message stored before blocks existed is a single text block. */
export const messageBlocks = (message: Message): MessageBlock[] =>
    message.blocks ?? (message.content ? [{kind: 'text', text: message.content}] : []);

/** "28 October 2026": spelled out, so no reader has to guess which number is the month. */
export const formatExportDate = (date: Date): string =>
    date.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'});

const isoDay = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const FOLDED: Record<string, string> = {ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd'};

/** `eosc-data-commons-conversation-<title>-<yyyy-mm-dd>.md`, the title reduced to plain ASCII. */
export const exportFileName = (title: string, exportedAt: Date): string => {
    const slug = title
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        // Letters with no decomposition to strip an accent from.
        .replace(/[ßæœøłđ]/g, letter => FOLDED[letter])
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .slice(0, 60)
        .replace(/-+$/, '');
    return `eosc-data-commons-conversation-${slug || 'untitled'}-${isoDay(exportedAt)}.md`;
};

// ── Tool calls ───────────────────────────────────────────────────────────────

export interface ToolCallSummary {
    // The name the thread shows the tool by ("Searched datasets").
    label: string;
    // "20 results", "3 files"; null for a tool that returns neither.
    count: string | null;
    // Pretty-printed `{tool, arguments, results}`: what was asked, and how much came back.
    json: string;
}

/**
 * The arguments exactly as the model sent them. Valid JSON is kept as an object so it
 * prints readably; anything else is kept as the raw string rather than dropped.
 */
const parseArguments = (raw: string): unknown => {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
        return JSON.parse(trimmed);
    } catch {
        return raw;
    }
};

/**
 * One tool call as the export shows it. The raw output is left out on purpose: for a tool
 * the UI does not recognise it can be pages long, and the datasets the answer relies on
 * are listed under it in full.
 */
export const toolCallSummary = (toolCall: ToolCall): ToolCallSummary => {
    // The same reading of the result as the tool call entry in the thread.
    const files = toolCall.output ? parseDatasetFiles(toolCall.output) : null;
    const count = toolCall.hits?.length ?? files?.length ?? null;
    const noun = toolCall.hits ? 'result' : 'file';

    const record: Record<string, unknown> = {
        tool: toolCall.name,
        arguments: parseArguments(toolCall.args),
    };
    if (count !== null) record.results = count;

    return {
        label: toolLabel(toolCall.name),
        count: count === null ? null : `${count} ${noun}${count === 1 ? '' : 's'}`,
        json: JSON.stringify(record, null, 2),
    };
};

// ── Cited datasets ───────────────────────────────────────────────────────────

export interface ReferenceEntry {
    number: number;
    dataset: BackendDataset;
    // The APA citation without its trailing link.
    citation: string;
    // The link the citation ends with, as text; null when there is none to split off.
    link: string | null;
    // `link` when it is a usable web address, for rendering it as a live link.
    href: string | null;
}

/**
 * The reference list of one answer, in APA: the Cite panel's default style. Built from the
 * search metadata rather than doi.org, which would mean one request per cited dataset.
 */
export const referenceEntries = (citations: DatasetCitation[]): ReferenceEntry[] =>
    citations.map(({number, dataset}) => {
        const full = formatCitation(dataset, 'apa');
        // The URL formatCitation ends every APA citation with.
        const doi = datasetDOI(dataset);
        const link = doi ? `https://doi.org/${doi}` : dataset._id;
        if (!link || !full.endsWith(link)) {
            return {number, dataset, citation: full, link: null, href: null};
        }
        return {
            number,
            dataset,
            citation: full.slice(0, -link.length).trimEnd(),
            link,
            href: sanitizeLinkHref(link),
        };
    });

// ── Markdown ─────────────────────────────────────────────────────────────────

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Escapes text that is not Markdown (titles, questions, citations) so it reads as typed.
 * Brackets are escaped only where they would make a link, so the "[Data set]" of every APA
 * citation stays clean in the raw file. An underscore inside a word is left alone too: it
 * cannot start emphasis, and dataset names are full of them (ERA5_Land, total_precipitation).
 */
export const escapeMarkdown = (text: string): string =>
    text
        .replace(/[\\`*<>]/g, '\\$&')
        .replace(/](?=[([:])/g, '\\]')
        .replace(/_/g, (underscore, offset: number, whole: string) =>
            WORD_CHAR.test(whole[offset - 1] ?? '') && WORD_CHAR.test(whole[offset + 1] ?? '') ? underscore : '\\_')
        .split('\n')
        // A line that starts like a heading, quote, list item or rule would become one.
        .map(line => line.replace(/^(\s*)([#>+=-])/, '$1\\$2').replace(/^(\s*\d+)([.)])(?=\s)/, '$1\\$2'))
        .join('\n');

/** A fence longer than any run of backticks in `body`, so the body cannot close it early. */
const fenced = (body: string, language: string): string => {
    const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map(run => run.length));
    const fence = '`'.repeat(Math.max(3, longest + 1));
    return `${fence}${language}\n${body}\n${fence}`;
};

/**
 * The model's headings, two levels down, so they sit under the export's own "Answer"
 * heading instead of competing with the conversation title. Code blocks are left alone.
 */
export const demoteHeadings = (text: string): string => {
    let inCode = false;
    return text.split('\n').map(line => {
        if (/^\s{0,3}(```|~~~)/.test(line)) {
            inCode = !inCode;
            return line;
        }
        if (inCode) return line;
        return line.replace(/^(\s{0,3})(#{1,6})(?=\s|$)/, (_match, indent: string, hashes: string) =>
            indent + '#'.repeat(Math.min(6, hashes.length + 2)));
    }).join('\n');
};

// A Markdown link, its label kept to one line without brackets so that "[a] text [b](url)"
// marks the link "[b](url)" and not everything from the first bracket.
const LINK = /\[([^\]\n]+)]\((.+?)\)/g;

/**
 * Puts the reference number in front of every link to a cited dataset, "[1] [label](url)",
 * the same order the citation pill reads on screen. Other links are left as they are.
 */
export const markCitations = (
    text: string,
    datasets: Map<string, BackendDataset>,
    citations: DatasetCitation[],
): string => {
    const numbers = new Map(citations.map(citation => [citation.dataset, citation.number]));
    return text.replace(LINK, (link, _label: string, href: string, offset: number, whole: string) => {
        if (whole[offset - 1] === '!') return link; // an image, not a citation
        const dataset = datasets.get(normalizeDatasetUrl(href));
        const number = dataset ? numbers.get(dataset) : undefined;
        return number === undefined ? link : `[${number}] ${link}`;
    });
};

// As the thread shows it: a run of blank lines is one break, and no padding at the edges.
const tidy = (text: string): string => text.replace(/\n{3,}/g, '\n\n').trim();

const answerToMarkdown = (message: Message, datasets: Map<string, BackendDataset>): string[] => {
    const blocks = messageBlocks(message);
    const citations = collectCitations(blocks, datasets);
    const parts: string[] = [];

    for (const block of blocks) {
        if (block.kind === 'tool') {
            const summary = toolCallSummary(block.toolCall);
            parts.push(`**${escapeMarkdown(summary.label)}**${summary.count ? `, ${summary.count}` : ''}`);
            parts.push(fenced(summary.json, 'json'));
            continue;
        }
        const text = tidy(block.text);
        if (text) parts.push(demoteHeadings(markCitations(text, datasets, citations)));
    }

    if (citations.length > 0) {
        parts.push('**Datasets cited in this answer**');
        parts.push(referenceEntries(citations).map(entry => {
            const link = entry.href ? ` <${entry.href}>` : entry.link ? ` ${escapeMarkdown(entry.link)}` : '';
            return `${entry.number}. ${escapeMarkdown(entry.citation)}${link}`;
        }).join('\n'));
    }
    return parts;
};

/** The whole conversation as a Markdown document, branded at the top and the bottom. */
export const conversationToMarkdown = (
    {title, messages}: ExportableConversation,
    {origin, exportedAt, version, author}: ExportOptions,
): string => {
    const datasets = buildDatasetUrlMap(messages);
    const parts: string[] = [
        `# ${escapeMarkdown(title)}`,
        `![${SITE_NAME}](${origin}${LOGO_PATH})`,
        `AI Mode conversation, exported on ${formatExportDate(exportedAt)} from [${SITE_NAME}](${origin}).`,
    ];
    if (author) parts.push(`Exported by ${escapeMarkdown(author)}.`);
    parts.push('---');

    for (const message of messages) {
        if (message.sender === 'user') {
            parts.push('## Question', escapeMarkdown(message.content));
        } else if (message.isError) {
            parts.push('## Answer', `> Error: ${escapeMarkdown(message.content)}`);
        } else {
            parts.push('## Answer', ...answerToMarkdown(message, datasets));
        }
    }

    parts.push(
        '---',
        `Generated with ${SITE_NAME} AI Mode, <${origin}>`,
        AI_DISCLAIMER,
        FUNDING_STATEMENT,
        `Version ${version}.`,
    );
    return `${parts.join('\n\n')}\n`;
};

/** Saves the conversation as a Markdown file, the way the Cite panel saves BibTeX. */
export const downloadConversationMarkdown = (conversation: ExportableConversation, options: ExportOptions) => {
    const markdown = conversationToMarkdown(conversation, options);
    const blob = new Blob([markdown], {type: 'text/markdown;charset=utf-8'});
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = exportFileName(conversation.title, options.exportedAt);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(anchor.href);
};
