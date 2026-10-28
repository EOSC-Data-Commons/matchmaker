import {useMemo} from "react";
import type {Message, ToolCall} from "@/types/chat.ts";
import type {BackendDataset} from "@/types/commons.ts";
import {buildDatasetUrlMap, collectCitations} from "@/lib/datasetCitations.ts";
import {
    type ExportableConversation,
    type ExportOptions,
    formatExportDate,
    messageBlocks,
    type ReferenceEntry,
    referenceEntries,
    toolCallSummary,
} from "@/lib/conversationExport.ts";
import {AI_DISCLAIMER, FUNDING_STATEMENT, SITE_NAME} from "@/lib/branding.ts";
import {sanitizeLinkHref} from "@/lib/utils.ts";
import {MessageMarkdown} from "./MessageMarkdown.tsx";
import {ToolIcon} from "./ToolCallEntry.tsx";
import eoscLogo from "@/assets/logo-eosc-data-commons.svg";
import euLogo from "@/assets/EU_blue.png";

type ConversationExportViewProps = ExportableConversation & ExportOptions;

const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-[#646363] break-after-avoid';

/** One tool call: what the thread calls it, and the JSON of what was asked and how much came back. */
const ExportToolCall = ({toolCall}: { toolCall: ToolCall }) => {
    const {label, count, json} = toolCallSummary(toolCall);
    return (
        <div className="break-inside-avoid">
            <p className="flex items-center gap-1.5 text-[13px] text-gray-600">
                <ToolIcon name={toolCall.name} className="h-3.5 w-3.5 shrink-0 text-blue-600"/>
                <span><span className="font-medium text-gray-800">{label}</span>{count && `, ${count}`}</span>
            </p>
            <pre
                className="mt-1.5 whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-[11px] leading-snug text-gray-700">
                {json}
            </pre>
        </div>
    );
};

/** The answer's numbered reference list, as citations someone can copy into a paper. */
const ExportReferences = ({entries}: { entries: ReferenceEntry[] }) => (
    <section aria-label="Datasets cited in this answer" className="border-t border-gray-200 pt-3 whitespace-normal">
        <h3 className="text-sm font-semibold text-gray-900 break-after-avoid">Datasets cited in this answer</h3>
        <ol className="mt-2 list-none space-y-2 p-0">
            {entries.map(entry => (
                <li
                    key={entry.number}
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-1 text-[13px] leading-snug break-inside-avoid"
                >
                    <span className="font-semibold tabular-nums text-blue-700">[{entry.number}]</span>
                    <span className="text-gray-700 [overflow-wrap:anywhere]">
                        {entry.citation}
                        {entry.link && ' '}
                        {entry.href ? (
                            <a href={entry.href} target="_blank" rel="noopener noreferrer"
                               className="text-blue-600 underline">
                                {entry.link}
                            </a>
                        ) : entry.link}
                    </span>
                </li>
            ))}
        </ol>
    </section>
);

/**
 * An answer as the thread showed it, minus the controls: its tool calls and text in the
 * order the agent produced them, then the datasets it cites. The citation pills keep their
 * numbers and link straight to the dataset, since there is no list to jump to on paper.
 */
const ExportAnswer = ({message, datasets}: { message: Message; datasets: Map<string, BackendDataset> }) => {
    const blocks = messageBlocks(message);
    const citations = collectCitations(blocks, datasets);
    return (
        <div className="mt-1.5 space-y-4 text-[15px] text-gray-800">
            {blocks.map((block, index) => {
                if (block.kind === 'tool') {
                    return <ExportToolCall key={`tool-${block.toolCall.id}`} toolCall={block.toolCall}/>;
                }
                if (!block.text.trim()) return null;
                // Tables wrap to the page instead of scrolling, and no row is split between pages.
                return (
                    <div
                        key={`text-${index}`}
                        className="whitespace-pre-wrap break-words [&_table]:min-w-0 [&_.overflow-x-auto]:overflow-visible [&_tr]:break-inside-avoid"
                    >
                        <MessageMarkdown text={block.text} datasets={datasets} citations={citations}/>
                    </div>
                );
            })}
            {citations.length > 0 && <ExportReferences entries={referenceEntries(citations)}/>}
        </div>
    );
};

/**
 * A conversation as a branded document, for printing to PDF. It holds the same content as
 * the Markdown export.
 *
 * Laid out as a one-cell table so the footer can sit in its `<tfoot>`: browsers repeat a
 * table footer on every printed page and leave room for it, which a fixed-position footer
 * does not (it prints over the text).
 */
export const ConversationExportView = ({
                                           title,
                                           messages,
                                           origin,
                                           exportedAt,
                                           version,
                                           author
                                       }: ConversationExportViewProps) => {
    const datasets = useMemo(() => buildDatasetUrlMap(messages), [messages]);
    const originHref = sanitizeLinkHref(origin);

    return (
        <article data-export-document="" className="w-full bg-white text-[#1A1A1A]">
            <table role="presentation" className="w-full border-collapse">
                <tbody>
                <tr>
                    <td className="p-0 align-top">
                        <header
                            className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E0E0E0] pb-4">
                            <img src={eoscLogo} alt={SITE_NAME} className="h-9 w-auto"/>
                            <div className="text-right text-xs leading-relaxed text-[#646363]">
                                <p className="font-semibold text-[#002337]">AI Mode conversation</p>
                                <p>Exported on {formatExportDate(exportedAt)}</p>
                                {originHref && (
                                    <p>from <a href={originHref} className="underline">{origin}</a></p>
                                )}
                                {author && <p>Exported by {author}</p>}
                            </div>
                        </header>

                        <h1 className="mt-6 text-2xl font-semibold text-gray-900 break-words">{title}</h1>

                        {messages.map((message, index) => message.sender === 'user' ? (
                            <section key={index} className="mt-8 break-inside-avoid">
                                <h2 className={LABEL}>Question</h2>
                                <p className="mt-1.5 whitespace-pre-wrap break-words rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[15px] leading-relaxed text-[#002337]">
                                    {message.content}
                                </p>
                            </section>
                        ) : (
                            <section key={index} className="mt-5">
                                <h2 className={LABEL}>Answer</h2>
                                {message.isError ? (
                                    <p className="mt-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-700">
                                        Error: {message.content}
                                    </p>
                                ) : (
                                    <ExportAnswer message={message} datasets={datasets}/>
                                )}
                            </section>
                        ))}
                    </td>
                </tr>
                </tbody>
                <tfoot>
                <tr>
                    <td className="p-0">
                        <footer
                            className="mt-10 flex items-start justify-between gap-6 border-t border-[#E0E0E0] pt-3 text-[11px] leading-relaxed text-[#646363]">
                            <div>
                                <p>
                                    Generated with {SITE_NAME} AI Mode
                                    {originHref && <>, <a href={originHref} className="underline">{origin}</a></>}
                                </p>
                                <p>{AI_DISCLAIMER}</p>
                            </div>
                            <div className="flex shrink-0 items-start gap-2 text-right">
                                <div className="max-w-[17rem]">
                                    <p>{FUNDING_STATEMENT}</p>
                                    <p>Version {version}</p>
                                </div>
                                <img src={euLogo} alt="Flag of the European Union" className="h-6 w-auto"/>
                            </div>
                        </footer>
                    </td>
                </tr>
                </tfoot>
            </table>
        </article>
    );
};
