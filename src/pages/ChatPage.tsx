import {FC, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useLocation, useNavigate, useParams} from "react-router";
import {useAuth} from "@/hooks/useAuth.ts";
import {loginWithReturn} from "@/lib/authRedirect.ts";
import {Conversation, Message} from "@/types/chat.ts";
import {sendChatMessage, RateLimitError, ServerError} from "@/lib/api.ts";
import {applyChatEvent, finalizeStream, parseConversationItems} from "@/lib/chatMessages.ts";
import {buildDatasetUrlMap} from "@/lib/datasetCitations.ts";
import {getUserInitials} from "@/lib/userUtils.ts";
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import {ChevronDown, ChevronUp, Loader2, Menu, MessageSquare, Plus, Send, User, X} from "lucide-react";
import {MessageMarkdown} from "@/components/MessageMarkdown.tsx";
import {ToolCallEntry} from "@/components/ToolCallEntry.tsx";
import {SearchInput} from "@/components/SearchInput.tsx";
import {DeleteConversationDialog} from "@/components/DeleteConversationDialog.tsx";
import {ConversationSidebarItem} from "@/components/ConversationSidebarItem.tsx";
import {SearchFeedback} from "@/components/SearchFeedback.tsx";
import useMatomo from "@/hooks/useMatomo.ts";
import {errorKind} from "@/lib/analytics.ts";

type ChatLocationState = {
    initialQuery?: string;
    initialModel?: string;
};

const isChatLocationState = (state: unknown): state is ChatLocationState => {
    if (!state || typeof state !== 'object') return false;
    const candidate = state as Record<string, unknown>;
    const hasValidInitialQuery = candidate.initialQuery === undefined || typeof candidate.initialQuery === 'string';
    const hasValidInitialModel = candidate.initialModel === undefined || typeof candidate.initialModel === 'string';
    return hasValidInitialQuery && hasValidInitialModel;
};

/** Total number of search hits returned by a bot message's tool calls. */
const countHits = (msg: Message): number =>
    (msg.blocks ?? []).reduce((acc, b) => acc + (b.kind === 'tool' ? (b.toolCall.hits?.length ?? 0) : 0), 0);

const ChatPage: FC = () => {
    const {id: urlId} = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const {user, loading: userLoading} = useAuth();
    const {trackEvent} = useMatomo();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set());
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    // Below `md` the sidebar is an off-canvas drawer; at `md` and up it is always
    // visible and this flag is ignored.
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const activeIdRef = useRef<string | undefined>(undefined);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    activeIdRef.current = selectedConversation?.id;

    // To prevent processing initial state multiple times
    const initialQueryProcessed = useRef(false);

    // Whether the view is following the bottom of the thread; false once the user
    // scrolls up, so streamed content does not yank them back down.
    const followingRef = useRef(true);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView?.({behavior: "smooth"});
    };

    const scrollToBottomIfFollowing = () => {
        if (!followingRef.current) return;
        requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView?.({block: 'end'}));
    };

    const handleScroll = () => {
        if (!messagesContainerRef.current) return;
        const {scrollTop, scrollHeight, clientHeight} = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        followingRef.current = isNearBottom;
        setShowScrollButton(!isNearBottom);
    };

    const focusChatInput = useCallback(() => {
        requestAnimationFrame(() => {
            chatInputRef.current?.focus();
        });
    }, []);

    const fetchConversations = useCallback(() => {
        if (user?.sub) {
            fetch('/api/search/conversations')
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Failed to fetch conversations: ${res.status} ${res.statusText}`);
                    }
                    return res.json();
                })
                .then(data => {
                    const dataArray = Array.isArray(data) ? data : Object.values(data || {});
                    const mapped_data = dataArray.map((item: Record<string, string>) => ({
                        ...item,
                        id: item.thread_id || item.id,
                        title: item.label || item.title,
                    }));
                    setConversations(mapped_data as Conversation[]);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch conversations", err);
                    setLoading(false);
                });
        }
    }, [user?.sub]);

    // Keep a ref to the latest fetchConversations so async flows (e.g. a chat
    // started from the landing page before `user` has loaded) refresh the
    // sidebar using the current closure instead of a stale one.
    const fetchConversationsRef = useRef(fetchConversations);
    fetchConversationsRef.current = fetchConversations;

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    const handleSelectConversation = useCallback((id: string) => {
        setLoading(true);
        fetch(`/api/search/conversation/${id}`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch conversation: ${res.status} ${res.statusText}`);
                }
                return res.json();
            })
            .then(data => {
                const parsedMessages = parseConversationItems(data.items);

                const formattedConversation: Conversation = {
                    id: data.thread_id || data.id || id,
                    title: data.label || data.title || 'Conversation',
                    messages: parsedMessages.length > 0 ? parsedMessages : (data.messages || [])
                };

                setSelectedConversation(formattedConversation);
                setLoading(false);
                if (urlId !== id) {
                    navigate(`/chat/${id}`);
                }
            })
            .catch(err => {
                console.error("Failed to fetch conversation", err);
                setLoading(false);
            });
    }, [navigate, urlId]);

    useEffect(() => {
        if (urlId) {
            if (activeIdRef.current !== urlId) {
                handleSelectConversation(urlId);
            }
        } else {
            setSelectedConversation(null);
        }
    }, [urlId, handleSelectConversation]);

    useEffect(() => {
        const state = location.state;
        if (
            isChatLocationState(state) &&
            state.initialQuery &&
            !initialQueryProcessed.current
        ) {
            const {initialQuery, initialModel} = state;
            initialQueryProcessed.current = true;
            // Clear the state so a refresh doesn't trigger it again
            navigate(location.pathname, {replace: true, state: {}});

            // Wait slightly for layout to settle before sending
            setTimeout(() => {
                handleSendMessage(initialQuery, initialModel || 'cesnet/agentic');
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location, navigate]);

    // Reset collapsed state when switching conversations
    const [prevConversationId, setPrevConversationId] = useState(selectedConversation?.id);
    if (prevConversationId !== selectedConversation?.id) {
        setPrevConversationId(selectedConversation?.id);
        setCollapsedMessages(new Set());
    }

    useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null);
        if (menuOpenId) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [menuOpenId]);

    useEffect(() => {
        if (!sidebarOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSidebarOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [sidebarOpen]);

    const handleDeleteConversation = async (id: string) => {
        try {
            let res = await fetch('/api/search/conversations', {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify([id])
            });
            if (res.status === 422) {
                res = await fetch('/api/search/conversations', {
                    method: 'DELETE',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({thread_ids: [id]})
                });
            }
            if (!res.ok) {
                throw new Error(`Failed to delete conversation: ${res.statusText}`);
            }

            setConversations(prev => prev.filter(c => c.id !== id));
            if (selectedConversation?.id === id || urlId === id) {
                setSelectedConversation(null);
                navigate('/chat', {replace: true});
            }
        } catch (err) {
            console.error("Failed to delete conversation", err);
            alert("Failed to delete conversation. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    const toggleMessageCollapse = (index: number) => {
        setCollapsedMessages(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const getMessageSummary = (content: string): string => {
        // Return the first non-empty line of the content as the summary.
        // Previously this truncated to a fixed character limit; show the full summary instead.
        return content.split('\n').find(l => l.trim()) || '';
    };

    const handleSendMessage = async (messageText: string, model: string) => {
        if (!messageText.trim()) return;
        if (isSending) return; // Prevent concurrent sends

        trackEvent('Chat', 'message_sent', model);
        const runStartedAt = Date.now();

        const userMessage: Message = {sender: 'user', content: messageText};

        const currentConversation = selectedConversation || {
            id: 'new-' + Date.now(),
            title: 'New Conversation',
            messages: []
        };

        const updatedMessages = [...currentConversation.messages, userMessage];

        setSelectedConversation({
            ...currentConversation,
            messages: updatedMessages,
        });
        setIsSending(true);
        setTimeout(scrollToBottom, 50);

        // Turn a stream failure into a user-facing error bubble instead of a
        // silent console.error that dead-ends the chat.
        const errorText = (error: unknown): string => {
            if (error instanceof RateLimitError || error instanceof ServerError) return error.message;
            if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
                return "The search timed out — please try again.";
            }
            return "Something went wrong while searching. Please try again.";
        };
        // The whole assistant turn is reduced into this local list, then pushed to
        // state on every event so tool calls and text appear as they stream in.
        let streamed: Message[] = updatedMessages;
        const publish = () => {
            setSelectedConversation(prev => prev ? {...prev, messages: streamed} : null);
            scrollToBottomIfFollowing();
        };

        // The bubble goes into `streamed` too — a later publish would otherwise drop it.
        // Takes the raw error rather than the formatted text so the failure can be
        // classified for analytics in the one place every failure path converges on.
        const appendErrorBubble = (error: unknown) => {
            trackEvent('Chat', 'run_error', errorKind(error));
            streamed = [...finalizeStream(streamed), {sender: 'bot', content: errorText(error), isError: true}];
            publish();
            setIsSending(false);
        };

        try {
            await sendChatMessage(
                updatedMessages,
                model,
                currentConversation.id.startsWith('new-') ? undefined : currentConversation.id,
                (event) => {
                    if (event.type === 'RUN_STARTED' && event.thread_id && currentConversation.id.startsWith('new-')) {
                        const newThreadId = event.thread_id;
                        navigate(`/chat/${newThreadId}`, {replace: true});
                        setSelectedConversation(prev => prev ? {...prev, id: newThreadId} : null);
                        return;
                    }
                    if (event.type !== 'RUN_ERROR' && event.error) {
                        console.error("Event error:", event.error);
                        appendErrorBubble(new Error(event.error));
                        return;
                    }
                    if (event.type === 'TOOL_CALL_START' && event.tool_call_name) {
                        trackEvent('Chat', 'tool_call', event.tool_call_name);
                    }
                    streamed = applyChatEvent(streamed, event);
                    publish();
                    if (event.type === 'RUN_FINISHED') {
                        // Latency and hit count are the two things the chat funnel
                        // could not be judged on before: whether the agent answered,
                        // and whether it found anything.
                        const finished = streamed[streamed.length - 1];
                        trackEvent('Chat', 'run_latency_ms', model, Date.now() - runStartedAt);
                        if (finished?.sender === 'bot') {
                            trackEvent('Chat', 'results_returned', model, countHits(finished));
                        }
                        setIsSending(false);
                    }
                },
                (error) => {
                    console.error("Failed to send message", error);
                    appendErrorBubble(error);
                }
            );
        } catch (e) {
            console.error("Failed to send message", e);
            appendErrorBubble(e);
        } finally {
            // A stream that ends without RUN_FINISHED would otherwise leave the
            // message flagged as still streaming.
            streamed = finalizeStream(streamed);
            publish();
            setIsSending(false);
            fetchConversationsRef.current();
        }
    };

    // Every dataset URL cited anywhere in this thread's search results, so a plain
    // Markdown link in the answer can be resolved back to the dataset it cites.
    const datasetsByUrl = useMemo(
        () => buildDatasetUrlMap(selectedConversation?.messages ?? []),
        [selectedConversation?.messages]
    );

    // The assistant bubble already shows its own progress once blocks arrive.
    const messages = selectedConversation?.messages ?? [];
    const lastMessage = messages[messages.length - 1];
    const lastMessageIsStreaming = !!lastMessage?.isStreaming && (lastMessage.blocks?.length ?? 0) > 0;

    /** Bot message body: tool calls and text in the order the agent produced them. */
    const renderBotMessage = (msg: Message, msgIndex: number) => {
        const blocks = msg.blocks ?? (msg.content ? [{kind: 'text' as const, text: msg.content}] : []);
        const lastTextIndex = blocks.reduce((acc, b, i) => (b.kind === 'text' ? i : acc), -1);

        return blocks.map((block, blockIndex) => {
            if (block.kind === 'tool') {
                return (
                    <ToolCallEntry
                        key={`tool-${msgIndex}-${block.toolCall.id}`}
                        toolCall={block.toolCall}
                        isLoggedIn={!!user}
                    />
                );
            }
            if (!block.text.trim()) return null;
            return (
                <div key={`text-${msgIndex}-${blockIndex}`}>
                    <MessageMarkdown
                        text={block.text}
                        datasets={datasetsByUrl}
                        streaming={msg.isStreaming && blockIndex === lastTextIndex}
                        isLoggedIn={!!user}
                    />
                </div>
            );
        });
    };

    return (
        <div className="flex flex-col h-dvh bg-white overflow-hidden">
            <DeleteConversationDialog
                isOpen={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={() => deletingId && handleDeleteConversation(deletingId)}
            />
            {!userLoading && !user && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div
                        className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center border border-gray-100">
                        <div
                            className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <User className="h-8 w-8"/>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Authentication Required</h2>
                        <p className="text-gray-600 mb-8 leading-relaxed">
                            Please log in to your account to access the AI chat capabilities and view your conversation
                            history.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={loginWithReturn}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-sm cursor-pointer"
                            >
                                Log In to Continue
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer"
                            >
                                Return to Home
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Header */}
            <header
                className="bg-white border-b border-gray-200 shrink-0 py-3 px-4 md:px-6 flex items-center gap-3 shadow-sm z-10">
                <button
                    type="button"
                    onClick={() => setSidebarOpen(open => !open)}
                    aria-label={sidebarOpen ? "Close conversations" : "Open conversations"}
                    aria-expanded={sidebarOpen}
                    className="md:hidden -ml-2 p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                    {sidebarOpen ? <X className="h-6 w-6"/> : <Menu className="h-6 w-6"/>}
                </button>
                <img
                    src={dataCommonsIconBlue}
                    alt="EOSC Logo"
                    className="h-8 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/')}
                />
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Backdrop for the mobile drawer */}
                {sidebarOpen && (
                    <div
                        className="md:hidden absolute inset-0 bg-black/40 z-30"
                        onClick={() => setSidebarOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* Sidebar */}
                <div
                    className={`absolute inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 transition-transform duration-200 ease-out md:static md:z-auto md:w-80 md:max-w-none md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                >
                    <div className="p-4 border-b border-gray-200">
                        <button
                            onClick={() => {
                                setSelectedConversation(null);
                                if (urlId) navigate('/chat');
                                setSidebarOpen(false);
                                focusChatInput();
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm cursor-pointer"
                        >
                            <Plus className="h-5 w-5"/>
                            New Chat
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {loading && conversations.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center mt-4">Loading conversations...</p>
                        ) : (
                            conversations.map(convo => {
                                const isActive = convo.id === selectedConversation?.id || convo.id === urlId;
                                return (
                                    <ConversationSidebarItem
                                        key={convo.id}
                                        conversation={convo}
                                        isActive={isActive}
                                        menuOpen={menuOpenId === convo.id}
                                        onClick={() => {
                                            handleSelectConversation(convo.id);
                                            setSidebarOpen(false);
                                        }}
                                        onMenuToggle={(e) => {
                                            e.stopPropagation();
                                            setMenuOpenId(menuOpenId === convo.id ? null : convo.id);
                                        }}
                                        onDeleteClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingId(convo.id);
                                            setMenuOpenId(null);
                                        }}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col bg-white min-w-0 relative">
                    {/* Header */}
                    {selectedConversation && (
                        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-white shrink-0">
                            <h1 className="text-base md:text-lg font-semibold text-gray-800 wrap-break-word line-clamp-2 md:line-clamp-none">
                                {conversations.find(c => c.id === selectedConversation.id)?.title || selectedConversation.title}
                            </h1>
                        </div>
                    )}

                    {/* Messages */}
                    <div
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 p-4 md:p-6 overflow-y-auto bg-gray-50"
                    >
                        <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
                            {!selectedConversation || selectedConversation.messages.length === 0 ? (
                                <div
                                    className="flex flex-col items-center justify-center h-full min-h-64 text-center mt-20">
                                    <div
                                        className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                        <MessageSquare className="h-8 w-8"/>
                                    </div>
                                    <h2 className="text-xl font-semibold text-gray-700 mb-2">Welcome to the EOSC Data
                                        Commons Chat</h2>
                                    <p className="text-gray-500 max-w-md">Start a new conversation by typing a message
                                        below
                                        to search datasets or ask questions.</p>
                                </div>
                            ) : (
                                selectedConversation.messages.map((msg, index) => (
                                    <div key={index}
                                         className={`w-full flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`group flex gap-2 md:gap-3 max-w-full md:max-w-[85%] min-w-0 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                                            {/* Avatar */}
                                            <div
                                                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm mt-1 overflow-hidden ${msg.sender === 'user' ? 'bg-[#002337] text-white text-sm font-medium' : 'bg-white border border-gray-100 p-1'}`}>
                                                {msg.sender === 'user' ? (
                                                    getUserInitials(user)
                                                ) : (
                                                    <img src={dataCommonsIconBlue} alt="Bot"
                                                         className="w-full h-full object-contain"/>
                                                )}
                                            </div>
                                            <div
                                                className={`rounded-2xl px-4 md:px-5 py-3 shadow-sm text-[15px] min-w-0 break-words ${
                                                    msg.isError
                                                        ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-sm whitespace-pre-wrap'
                                                        : msg.sender === 'user'
                                                            ? 'bg-blue-600 text-white rounded-tr-sm'
                                                            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm whitespace-pre-wrap'
                                                }`}
                                            >
                                                {msg.isError ? (
                                                    <p className="leading-relaxed">{msg.content}</p>
                                                ) : msg.sender === 'user' ? (
                                                    <p className="leading-relaxed">{msg.content}</p>
                                                ) : collapsedMessages.has(index) ? (
                                                    <div className="flex items-center gap-3">
                                                        <p className="text-gray-400 text-sm italic flex-1 whitespace-pre-wrap">
                                                            {getMessageSummary(msg.content)}
                                                            {countHits(msg) > 0 && (
                                                                <span
                                                                    className="ml-2 text-blue-400 font-medium not-italic">
                                                                    · {countHits(msg)} result{countHits(msg) !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </p>
                                                        <button
                                                            onClick={() => toggleMessageCollapse(index)}
                                                            className="shrink-0 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                                                            title="Expand message"
                                                        >
                                                            <ChevronDown className="h-4 w-4"/>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col space-y-4">
                                                        <div className="flex justify-end">
                                                            <button
                                                                onClick={() => toggleMessageCollapse(index)}
                                                                className="text-xs text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
                                                                title="Collapse message"
                                                            >
                                                                <ChevronUp className="h-3 w-3"/>
                                                                <span>Collapse</span>
                                                            </button>
                                                        </div>
                                                        {renderBotMessage(msg, index)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            {/* Loading Indicator — only until the answer starts streaming */}
                            {isSending && !lastMessageIsStreaming && (
                                <div className="w-full flex justify-start">
                                    <div className="flex gap-2 md:gap-3 max-w-full md:max-w-[85%]">
                                        <div
                                            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm bg-white border border-gray-100 mt-1 p-1 overflow-hidden">
                                            <img src={dataCommonsIconBlue} alt="Bot"
                                                 className="w-full h-full object-contain animate-pulse"/>
                                        </div>
                                        <div
                                            className="rounded-2xl px-4 md:px-5 py-3 shadow-sm text-[15px] bg-white border border-gray-200 text-gray-500 rounded-tl-sm flex items-center gap-3 min-w-0">
                                        <span className="flex gap-1.5 opacity-70">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                                  style={{animationDelay: '0.2s'}}></span>
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                                  style={{animationDelay: '0.4s'}}></span>
                                        </span>
                                            <span className="font-medium text-sm">Searching for datasets...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!isSending &&
                                selectedConversation &&
                                selectedConversation.messages[selectedConversation.messages.length - 1]?.sender === 'bot' &&
                                !selectedConversation.messages[selectedConversation.messages.length - 1]?.isError && (
                                    <div className="pl-11">
                                        <SearchFeedback
                                            key={`${selectedConversation.id}-${selectedConversation.messages.length}`}
                                            query={[...selectedConversation.messages].reverse().find(m => m.sender === 'user')?.content ?? selectedConversation.title}
                                        />
                                    </div>
                                )}
                            <div ref={messagesEndRef}/>
                        </div>
                    </div>

                    {showScrollButton && (
                        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20">
                            <button
                                onClick={() => {
                                    followingRef.current = true;
                                    scrollToBottom();
                                }}
                                className="p-2 bg-white border border-gray-200 shadow-md rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none flex items-center justify-center cursor-pointer"
                                title="Scroll to bottom"
                            >
                                <ChevronDown className="h-6 w-6"/>
                            </button>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="p-3 md:p-4 bg-white border-t border-gray-200 shrink-0">
                        <div className="max-w-6xl mx-auto">
                            <SearchInput
                                onSearch={handleSendMessage}
                                loading={isSending}
                                placeholder="Ask anything or search for datasets..."
                                placeholderShort="Ask or search datasets..."
                                clearOnSearch={true}
                                inputRef={chatInputRef}
                                buttonText={
                                    isSending ? (
                                        <>
                                            <Loader2 className="animate-spin h-5 w-5"/>
                                            <span className="text-sm font-medium">Sending...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-5 w-5"/>
                                            <span className="text-sm font-medium">Send</span>
                                        </>
                                    )
                                }
                                disableHistory={true}
                            />
                        </div>
                        <div className="max-w-6xl mx-auto text-center mt-3 text-xs text-gray-400">
                            AI-generated content may be incomplete or occasionally incorrect. Please verify critical
                            data.
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            {/*<div className="shrink-0 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.1)] z-10 w-full relative">*/}
            {/*    <Footer className="mt-0! py-4! scale-[0.85] origin-bottom overflow-hidden" translucent={false}/>*/}
            {/*</div>*/}
        </div>
    );
};

export default ChatPage;