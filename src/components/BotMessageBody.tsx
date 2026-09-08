import {useCallback, useMemo, useRef, useState} from "react";
import type {Message} from "../types/chat.ts";
import type {BackendDataset} from "../types/commons.ts";
import {collectCitations} from "../lib/datasetCitations.ts";
import {MessageMarkdown} from "./MessageMarkdown.tsx";
import {ToolCallEntry} from "./ToolCallEntry.tsx";
import {CitedDatasets, type JumpRequest} from "./CitedDatasets.tsx";

interface BotMessageBodyProps {
    message: Message;
    // Datasets citable in this thread, keyed by normalized URL (see buildDatasetUrlMap).
    datasets: Map<string, BackendDataset>;
    isLoggedIn: boolean;
}

/**
 * Body of an assistant message: its tool calls and text blocks in the order the
 * agent produced them, followed by the reference list of every dataset the text
 * cites. Citation numbers are assigned here, across all of the message's text
 * blocks, so the [n] markers and the list always agree.
 */
export const BotMessageBody = ({message, datasets, isLoggedIn}: BotMessageBodyProps) => {
    const blocks = useMemo(
        () => message.blocks ?? (message.content ? [{kind: 'text' as const, text: message.content}] : []),
        [message.blocks, message.content]
    );
    const citations = useMemo(() => collectCitations(blocks, datasets), [blocks, datasets]);
    const lastTextIndex = blocks.reduce((acc, b, i) => (b.kind === 'text' ? i : acc), -1);

    const [jump, setJump] = useState<JumpRequest | null>(null);
    const jumpSeq = useRef(0);
    const onCite = useCallback((number: number) => {
        jumpSeq.current += 1;
        setJump({number, seq: jumpSeq.current});
    }, []);

    return (
        <>
            {blocks.map((block, blockIndex) => {
                if (block.kind === 'tool') {
                    return (
                        <ToolCallEntry
                            key={`tool-${block.toolCall.id}`}
                            toolCall={block.toolCall}
                            isLoggedIn={isLoggedIn}
                        />
                    );
                }
                if (!block.text.trim()) return null;
                const streaming = !!message.isStreaming && blockIndex === lastTextIndex;
                return (
                    <div key={`text-${blockIndex}`}>
                        <MessageMarkdown
                            text={block.text}
                            datasets={datasets}
                            citations={citations}
                            onCite={onCite}
                            streaming={streaming}
                        />
                        {/* Where the words being written end; the chat page keeps this in view. */}
                        {streaming && <div data-streaming-end aria-hidden="true"/>}
                    </div>
                );
            })}
            <CitedDatasets citations={citations} isLoggedIn={isLoggedIn} jump={jump}/>
        </>
    );
};
