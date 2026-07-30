import {Fragment, JSX} from "react";
import type {BackendDataset} from "../types/commons.ts";
import {lookupDataset} from "../lib/datasetCitations.ts";
import {trimTrailingPartialLink} from "../lib/utils.ts";
import {DatasetReference} from "./DatasetReference.tsx";

interface MessageMarkdownProps {
    text: string;
    // Datasets citable in this thread, keyed by normalized URL (see buildDatasetUrlMap).
    datasets: Map<string, BackendDataset>;
    // True while this text is still streaming in.
    streaming?: boolean;
    isLoggedIn?: boolean;
}

const sanitizeLinkHref = (href: string): string | null => {
    const trimmed = href.trim();
    if (!trimmed) return null;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
        return null;
    }
};

/**
 * Renders the subset of Markdown the assistant produces: links, bold, and
 * ordered/unordered list lines. A link pointing at one of the thread's search
 * hits becomes an interactive dataset citation; any other link stays an ordinary
 * external link.
 */
export const MessageMarkdown = ({text, datasets, streaming = false, isLoggedIn = false}: MessageMarkdownProps) => {
    const renderInline = (line: string, lineIndex: number) => {
        // Handles **[label](url)**, [label](url), and **bold** in a single pass.
        const tokenRegex = /\*\*\[(.+?)]\((.+?)\)\*\*|\[(.+?)]\((.+?)\)|\*\*(.+?)\*\*/g;
        const nodes: (string | JSX.Element)[] = [];
        let lastIndex = 0;
        let tokenIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = tokenRegex.exec(line)) !== null) {
            if (match.index > lastIndex) {
                nodes.push(line.substring(lastIndex, match.index));
            }

            const [fullMatch, boldLinkText, boldLinkHref, linkText, linkHref, boldText] = match;
            const label = boldLinkText || linkText;
            const href = boldLinkHref || linkHref;
            if (label && href) {
                const safeHref = sanitizeLinkHref(href);
                if (!safeHref) {
                    nodes.push(label);
                    lastIndex = match.index + fullMatch.length;
                    continue;
                }
                const dataset = lookupDataset(datasets, safeHref);
                nodes.push(dataset ? (
                    <DatasetReference
                        key={`md-${lineIndex}-${tokenIndex++}`}
                        dataset={dataset}
                        label={label}
                        isLoggedIn={isLoggedIn}
                    />
                ) : (
                    <a
                        key={`md-${lineIndex}-${tokenIndex++}`}
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
                    <strong key={`md-${lineIndex}-${tokenIndex++}`} className="font-semibold text-gray-900">
                        {boldText}
                    </strong>
                );
            } else {
                nodes.push(fullMatch);
            }

            lastIndex = match.index + fullMatch.length;
        }

        if (lastIndex < line.length) {
            nodes.push(line.substring(lastIndex));
        }

        return nodes.map((node, idx) => <Fragment key={`md-frag-${lineIndex}-${idx}`}>{node}</Fragment>);
    };

    const content = streaming ? trimTrailingPartialLink(text) : text;

    return (
        <>
            {content.split('\n').map((rawLine, i) => {
                const trimmedLeft = rawLine.trimStart();
                const orderedMatch = trimmedLeft.match(/^(\d+)\.\s+(.*)$/);
                const unorderedMatch = trimmedLeft.match(/^[*-]\s+(.*)$/);
                const lineBody = orderedMatch?.[2] ?? unorderedMatch?.[1] ?? rawLine;

                const isMetadata =
                    trimmedLeft.startsWith('**Creator:**') ||
                    trimmedLeft.startsWith('**Published:**') ||
                    trimmedLeft.startsWith('**Description:**');

                return (
                    <p key={i} className={`leading-relaxed min-h-6 ${isMetadata ? 'text-gray-700 text-sm mt-1' : ''}`}>
                        {orderedMatch ? <span className="mr-2 font-medium text-gray-700">{orderedMatch[1]}.</span> : null}
                        {unorderedMatch ? <span className="mr-2 text-gray-500">•</span> : null}
                        {renderInline(lineBody, i)}
                    </p>
                );
            })}
        </>
    );
};
