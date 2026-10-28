import {FC, useCallback, useEffect, useRef, useState} from "react";
import {useLocation, useNavigate, useParams, useSearchParams} from "react-router";
import {ArrowLeft, FileText, Printer} from "lucide-react";
import type {Message} from "@/types/chat.ts";
import {useAuth} from "@/hooks/useAuth.ts";
import {useChatRuns} from "@/hooks/useChatRuns.ts";
import useMatomo from "@/hooks/useMatomo.ts";
import {findRun} from "@/lib/chatRuns.ts";
import {parseConversationItems} from "@/lib/chatMessages.ts";
import {downloadConversationMarkdown} from "@/lib/conversationExport.ts";
import {loginWithReturn} from "@/lib/authRedirect.ts";
import {getPublicName} from "@/lib/userUtils.ts";
import {SITE_NAME} from "@/lib/branding.ts";
import {ConversationExportView} from "@/components/ConversationExportView.tsx";
import {version} from "../../package.json";

interface LoadedConversation {
    id: string;
    title: string;
    messages: Message[];
}

const NO_MESSAGES: Message[] = [];

/** The title the chat page showed, handed over in the navigation state rather than the URL. */
const titleFromState = (state: unknown): string | undefined => {
    if (!state || typeof state !== 'object') return undefined;
    const title = (state as Record<string, unknown>).title;
    return typeof title === 'string' && title.trim() ? title : undefined;
};

/**
 * The printable view of a conversation, at /chat/:id/export. It opens the browser's print
 * dialog once the document is ready, where the reader saves it as a PDF.
 *
 * The thread comes from this page visit's run store when it is there, which also holds a
 * turn the backend has not stored yet, and from the backend otherwise. That is why the
 * export button navigates here in the same tab instead of opening a new one.
 */
const ChatExportPage: FC = () => {
    const {id} = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {user, loading: userLoading} = useAuth();
    const {trackEvent} = useMatomo();
    const runs = useChatRuns();
    const run = findRun(runs, id);
    const hasRun = run !== undefined;
    const signedIn = !!user;
    const [loaded, setLoaded] = useState<LoadedConversation | null>(null);
    const [failed, setFailed] = useState(false);
    const [exportedAt] = useState(() => new Date());
    const documentRef = useRef<HTMLDivElement>(null);
    const printedRef = useRef(false);

    useEffect(() => {
        if (!id || !signedIn || hasRun) return;
        let cancelled = false;
        fetch(`/api/search/conversation/${encodeURIComponent(id)}`)
            .then(res => {
                if (!res.ok) throw new Error(`Failed to fetch conversation: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(data => {
                if (cancelled) return;
                const parsed = parseConversationItems(data.items);
                setLoaded({
                    id,
                    title: data.label || data.title || 'Conversation',
                    messages: parsed.length > 0 ? parsed : (data.messages || []),
                });
            })
            .catch(err => {
                if (cancelled) return;
                console.error("Failed to fetch conversation", err);
                setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [id, signedIn, hasRun]);

    const conversation = run
        ? {title: run.title, messages: run.messages}
        : (loaded?.id === id ? loaded : null);
    const title = titleFromState(location.state) ?? conversation?.title ?? 'Conversation';
    const messages = conversation?.messages ?? NO_MESSAGES;
    const answering = messages.some(message => message.isStreaming);
    const ready = signedIn && messages.length > 0 && !answering;
    // Only whether to add the name travels in the address; the name comes from the session.
    const author = searchParams.get('byline') === '1' ? getPublicName(user) : undefined;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const print = useCallback(() => {
        // Browsers offer the page title as the PDF's file name. It is set for the print only:
        // analytics reads the title on page views, and this one is the reader's question.
        const previous = document.title;
        document.title = `${title}, ${SITE_NAME}`;
        const restore = () => {
            document.title = previous;
            window.removeEventListener('afterprint', restore);
        };
        window.addEventListener('afterprint', restore);
        window.print();
    }, [title]);

    // Open the print dialog once, after the fonts and the logos have loaded, or they print blank.
    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        const pending = [...(documentRef.current?.querySelectorAll('img') ?? [])]
            .filter(image => !image.complete)
            .map(image => new Promise(resolve => {
                image.addEventListener('load', resolve, {once: true});
                image.addEventListener('error', resolve, {once: true});
            }));
        let frame = 0;
        Promise.all([document.fonts?.ready, ...pending]).then(() => {
            if (cancelled || printedRef.current) return;
            frame = requestAnimationFrame(() => {
                printedRef.current = true;
                print();
            });
        });
        // Leaving the page before then must not open the dialog over the next one.
        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
        };
    }, [ready, print]);

    const downloadMarkdown = () => {
        downloadConversationMarkdown({title, messages}, {origin, exportedAt: new Date(), version, author});
        trackEvent('Chat', 'conversation_exported', 'markdown');
    };

    const status = (() => {
        if (userLoading) return 'Preparing the export…';
        if (!signedIn) return null;
        if (failed) return 'This conversation could not be loaded. Go back to it and try again.';
        if (!conversation) return 'Preparing the export…';
        if (messages.length === 0) return 'This conversation has no messages to export yet.';
        if (answering) return 'The answer is still being written. The export opens as soon as it is finished.';
        return null;
    })();

    const toolbarButton = 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer '
        + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 '
        + 'disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <div className="min-h-dvh bg-gray-100 print:min-h-0 print:bg-white">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white print:hidden">
                <div className="mx-auto flex max-w-[52rem] flex-wrap items-center justify-between gap-2 px-4 py-2">
                    <button
                        type="button"
                        onClick={() => navigate(id ? `/chat/${encodeURIComponent(id)}` : '/chat')}
                        className={`${toolbarButton} text-gray-700 hover:bg-gray-100`}
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true"/>
                        Back to conversation
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={downloadMarkdown}
                            disabled={!ready}
                            className={`${toolbarButton} border border-gray-300 text-gray-700 hover:bg-gray-50`}
                        >
                            <FileText className="h-4 w-4" aria-hidden="true"/>
                            Download Markdown
                        </button>
                        <button
                            type="button"
                            onClick={print}
                            disabled={!ready}
                            className={`${toolbarButton} bg-blue-600 text-white hover:bg-blue-700`}
                        >
                            <Printer className="h-4 w-4" aria-hidden="true"/>
                            Save as PDF
                        </button>
                    </div>
                </div>
            </div>

            <main className="px-4 py-6 print:p-0">
                {!userLoading && !signedIn && (
                    <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
                        <h1 className="text-xl font-semibold text-gray-900">Sign in to export this conversation</h1>
                        <p className="mt-2 text-sm text-gray-600">Your conversations are only available to you.</p>
                        <button
                            type="button"
                            onClick={loginWithReturn}
                            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 cursor-pointer"
                        >
                            Log in
                        </button>
                    </div>
                )}

                {status && (
                    <p role="status" className="mx-auto max-w-[52rem] py-16 text-center text-sm text-gray-600">
                        {status}
                    </p>
                )}

                {ready && (
                    <div
                        ref={documentRef}
                        className="mx-auto max-w-[52rem] rounded-lg bg-white p-6 shadow-sm sm:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none"
                    >
                        <ConversationExportView
                            title={title}
                            messages={messages}
                            origin={origin}
                            exportedAt={exportedAt}
                            version={version}
                            author={author}
                        />
                    </div>
                )}
            </main>
        </div>
    );
};

export default ChatExportPage;
