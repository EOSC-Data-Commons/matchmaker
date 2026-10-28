import {useState} from "react";
import {useNavigate} from "react-router";
import * as Popover from "@radix-ui/react-popover";
import {Download, FileText, Printer} from "lucide-react";
import type {Message} from "@/types/chat.ts";
import type {UserInfo} from "@/types/user.ts";
import {downloadConversationMarkdown} from "@/lib/conversationExport.ts";
import {getPublicName} from "@/lib/userUtils.ts";
import useMatomo from "@/hooks/useMatomo.ts";
import {version} from "../../package.json";

interface ExportConversationButtonProps {
    conversationId: string;
    title: string;
    messages: Message[];
    // The signed-in user, if any; only they are offered to add their name.
    user: UserInfo | null;
    // True while an answer is still being written.
    answering: boolean;
}

/**
 * Exports the open conversation, as a Markdown file or, through the printable view, as a
 * PDF. The exporter's name is left out unless they tick "Add my name", which starts
 * unticked every time: an exported file is meant to be passed on.
 *
 * The button stays enabled while an answer is being written and says why there is
 * nothing to export yet, rather than sitting disabled with no explanation.
 */
export const ExportConversationButton = ({
                                             conversationId,
                                             title,
                                             messages,
                                             user,
                                             answering
                                         }: ExportConversationButtonProps) => {
    const [open, setOpen] = useState(false);
    const [addName, setAddName] = useState(false);
    const navigate = useNavigate();
    const {trackEvent} = useMatomo();
    const authorName = getPublicName(user);
    const author = addName ? authorName : undefined;

    const exportMarkdown = () => {
        downloadConversationMarkdown({title, messages}, {
            origin: window.location.origin,
            exportedAt: new Date(),
            version,
            author,
        });
        trackEvent('Chat', 'conversation_exported', 'markdown');
        setOpen(false);
    };

    const exportPdf = () => {
        trackEvent('Chat', 'conversation_exported', 'pdf');
        // Same tab: a turn that has only just finished may exist only in this page's run
        // store until the backend has stored it. Only a yes/no for the byline goes into
        // the address; the name itself is read from the session on the other side.
        navigate(`/chat/${encodeURIComponent(conversationId)}/export${author ? '?byline=1' : ''}`, {state: {title}});
    };

    const itemClass = 'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 '
        + 'hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer';

    return (
        <Popover.Root
            open={open}
            onOpenChange={next => {
                setOpen(next);
                if (next) setAddName(false);
            }}
        >
            <Popover.Trigger asChild>
                <button
                    type="button"
                    aria-label="Export conversation"
                    title="Export conversation"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
                >
                    <Download className="h-4 w-4" aria-hidden="true"/>
                    <span className="hidden md:inline">Export</span>
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    aria-label="Export conversation"
                    align="end"
                    sideOffset={8}
                    collisionPadding={16}
                    className="z-50 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-gray-200 bg-white p-2 shadow-lg"
                >
                    {answering ? (
                        <p className="px-2 py-1.5 text-sm text-gray-600">
                            Available once the answer is finished.
                        </p>
                    ) : (
                        <>
                            {authorName && (
                                <label
                                    className="flex items-center gap-2 px-2 pt-1 pb-2 mb-1 border-b border-gray-100 text-sm text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={addName}
                                        onChange={event => setAddName(event.target.checked)}
                                        className="h-4 w-4 accent-blue-600 cursor-pointer"
                                    />
                                    Add my name
                                </label>
                            )}
                            <button type="button" onClick={exportMarkdown} className={itemClass}>
                                <FileText className="h-4 w-4 text-gray-500" aria-hidden="true"/>
                                Markdown file (.md)
                            </button>
                            <button type="button" onClick={exportPdf} className={itemClass}>
                                <Printer className="h-4 w-4 text-gray-500" aria-hidden="true"/>
                                PDF
                            </button>
                            <p className="px-2 pt-1.5 pb-1 text-xs text-gray-500">
                                Includes every answer, the searches behind it, and the datasets it cites.
                            </p>
                        </>
                    )}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};
