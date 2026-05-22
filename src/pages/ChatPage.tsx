import {FC, useState, useEffect, useCallback, Fragment, useRef, JSX} from "react";
import {useNavigate, useParams, useLocation} from "react-router";
import {useAuth} from "@/hooks/useAuth.ts";
import {Conversation, Message} from "@/types/chat.ts";
import {BackendDataset} from "@/types/commons.ts";
import {sendChatMessage} from "@/lib/api.ts";
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import {Plus, MessageSquare, User, Loader2, Send, ChevronDown, ChevronUp} from "lucide-react";
import {SearchResultItem} from "@/components/SearchResultItem.tsx";
import {SearchInput} from "@/components/SearchInput.tsx";

const ChatPage: FC = () => {
    const {id: urlId} = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const {user, loading: userLoading} = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set());
    const activeIdRef = useRef<string | undefined>(undefined);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    activeIdRef.current = selectedConversation?.id;

    // To prevent processing initial state multiple times
    const initialQueryProcessed = useRef(false);

    const getInitials = () => {
        if (!user) return "U";
        const name = user.name?.trim();
        if (name) {
            const names = name.split(/\s+/);
            if (names.length >= 2) {
                return (names[0][0] + names[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        }

        const preferredUsername = user.preferred_username?.trim();
        if (preferredUsername) {
            return preferredUsername.substring(0, 2).toUpperCase();
        }
        return user.email ? user.email.substring(0, 2).toUpperCase() : "U";
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
    };

    const handleScroll = () => {
        if (!messagesContainerRef.current) return;
        const {scrollTop, scrollHeight, clientHeight} = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
    };

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
                const parsedMessages: Message[] = [];
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach((item: Record<string, unknown>, idx: number) => {
                        if (item.type === 'message' && item.role === 'user') {
                            const contentObj = Array.isArray(item.content) && item.content[0] as Record<string, unknown>;
                            const text = Array.isArray(item.content) && contentObj?.text
                                ? String(contentObj.text)
                                : typeof item.content === 'string' ? item.content : '';
                            parsedMessages.push({sender: 'user', content: text});
                        } else if (item.type === 'message' && item.role === 'assistant') {
                            const contentObj = Array.isArray(item.content) && item.content[0] as Record<string, unknown>;
                            const text = Array.isArray(item.content) && contentObj?.text
                                ? String(contentObj.text)
                                : typeof item.content === 'string' ? item.content : '';
                            if (text.trim()) {
                                // Check if this is a standalone "No results found"
                                const isNoResultsOnly = text.trim() === 'No results found';
                                const hasPriorAssistantMessage = parsedMessages.some(m => m.sender === 'bot' && !m.hits);

                                // Look back to see if this is in response to a tool call
                                const prevItem = data.items && data.items[idx - 1];
                                const isResponseToTool = prevItem?.type === 'tool_result' || prevItem?.type === 'tool_call';

                                // Only suppress if it's a standalone "No results found" AND there's a prior assistant message AND it's not a tool response
                                if (isNoResultsOnly && hasPriorAssistantMessage && !isResponseToTool) {
                                    // Skip this message
                                } else {
                                    parsedMessages.push({sender: 'bot', content: text});
                                }
                            }
                        } else if (item.type === 'tool_result' && (item.call_id === 'rerank_results' || (item.metadata as Record<string, unknown>)?.name === 'rerank_results')) {
                            try {
                                const contentObj = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
                                if (contentObj && contentObj.summary && contentObj.hits) {
                                    const {summary, hits} = contentObj;
                                    parsedMessages.push({sender: 'bot', content: summary || "", hits: hits});
                                }
                            } catch (e) {
                                console.error("Failed to parse tool result content", e);
                            }
                        }
                    });
                }

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
        if (
            location.state &&
            location.state.initialQuery &&
            !initialQueryProcessed.current
        ) {
            const {initialQuery, initialModel} = location.state;
            initialQueryProcessed.current = true;
            // Clear the state so a refresh doesn't trigger it again
            navigate(location.pathname, {replace: true, state: {}});

            // Wait slightly for layout to settle before sending
            setTimeout(() => {
                handleSendMessage(initialQuery, initialModel || 'einfracz/qwen3-coder');
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location, navigate]);

    // Reset collapsed state when switching conversations
    useEffect(() => {
        setCollapsedMessages(new Set());
    }, [selectedConversation?.id]);

    const toggleMessageCollapse = (index: number) => {
        setCollapsedMessages(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const getMessageSummary = (content: string): string => {
        const firstLine = content.split('\n').find(l => l.trim()) || '';
        if (firstLine.length <= 120) return firstLine;
        return firstLine.substring(0, 117) + '...';
    };

    const sanitizeLinkHref = (href: string): string | null => {
        const trimmed = href.trim();
        if (!trimmed) return null;

        try {
            const parsed = new URL(trimmed);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.toString();
            }
            return null;
        } catch {
            return null;
        }
    };


    const handleSendMessage = async (messageText: string, model: string) => {
        if (!messageText.trim()) return;
        if (isSending) return; // Prevent concurrent sends

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

        try {
            let currentTextContent = "";
            let receivedRerank = false;
            let hasAddedMessage = false; // Track if we've added a message in this cycle
            const toolCallMap = new Map<string, string>();

            await sendChatMessage(
                updatedMessages,
                model,
                currentConversation.id.startsWith('new-') ? undefined : currentConversation.id,
                (event) => {
                    if (event.type === 'TOOL_CALL_START' && event.tool_call_id && event.tool_call_name) {
                        toolCallMap.set(event.tool_call_id, event.tool_call_name);
                    } else if (event.type === 'RUN_STARTED' && event.thread_id && currentConversation.id.startsWith('new-')) {
                        const newThreadId = event.thread_id;
                        navigate(`/chat/${newThreadId}`, {replace: true});
                        setSelectedConversation(prev => prev ? {...prev, id: newThreadId} : null);
                        // Also update currentConversation in scope so subsequent handlers during this stream don't misbehave if they need it, though they use prev.
                    } else if (event.type === 'TOOL_CALL_RESULT' && event.content && event.tool_call_id && (toolCallMap.get(event.tool_call_id) === 'rerank_results' || event.tool_call_id === 'rerank_results')) {
                        receivedRerank = true;
                        const result = JSON.parse(event.content);
                        const {summary, hits} = result;

                        const botMessage: Message = {sender: 'bot', content: summary || "", hits: hits};

                        setSelectedConversation(prev => {
                            if (!prev) return null;
                            return {...prev, messages: [...prev.messages, botMessage]};
                        });
                        hasAddedMessage = true;
                        setIsSending(false);
                    } else if (event.type === 'TEXT_MESSAGE_CHUNK' && event.delta) {
                        currentTextContent += event.delta;
                    } else if (event.type === 'TEXT_MESSAGE_END') {
                        if (currentTextContent.trim() && !receivedRerank) {
                            // Only add "No results found" if no other message was added in this cycle
                            const isNoResultsOnly = currentTextContent.trim() === 'No results found';
                            if (isNoResultsOnly && hasAddedMessage) {
                                // Skip it — we already have content from a tool result
                            } else {
                                const botMessage: Message = {sender: 'bot', content: currentTextContent};
                                setSelectedConversation(prev => {
                                    if (!prev) return null;
                                    return {...prev, messages: [...prev.messages, botMessage]};
                                });
                                hasAddedMessage = true;
                            }
                        }
                        currentTextContent = "";
                        receivedRerank = false;
                        setIsSending(false);
                    } else if (event.type === 'RUN_FINISHED') {
                        setIsSending(false);
                    } else if (event.error) {
                        setIsSending(false);
                        console.error("Event error:", event.error);
                    }
                },
                (error) => {
                    console.error("Failed to send message", error);
                    setIsSending(false);
                }
            );
        } catch (e) {
            console.error("Failed to send message", e);
            setIsSending(false);
        } finally {
            fetchConversations();
        }
    };

    const renderInlineMarkdown = (line: string, lineIndex: number) => {
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
            if (boldLinkText && boldLinkHref) {
                const safeHref = sanitizeLinkHref(boldLinkHref);
                if (!safeHref) {
                    nodes.push(boldLinkText);
                    lastIndex = match.index + fullMatch.length;
                    continue;
                }
                nodes.push(
                    <a
                        key={`md-${lineIndex}-${tokenIndex++}`}
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 underline font-semibold break-all"
                    >
                        {boldLinkText}
                    </a>
                );
            } else if (linkText && linkHref) {
                const safeHref = sanitizeLinkHref(linkHref);
                if (!safeHref) {
                    nodes.push(linkText);
                    lastIndex = match.index + fullMatch.length;
                    continue;
                }
                nodes.push(
                    <a
                        key={`md-${lineIndex}-${tokenIndex++}`}
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 underline font-medium break-all"
                    >
                        {linkText}
                    </a>
                );
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

    const renderMessageContent = (content: string) => {
        const lines = content.split('\n');

        return lines.map((rawLine, i) => {
            const trimmedLeft = rawLine.trimStart();
            const orderedMatch = trimmedLeft.match(/^(\d+)\.\s+(.*)$/);
            const unorderedMatch = trimmedLeft.match(/^[*-]\s+(.*)$/);
            const lineBody = orderedMatch?.[2] ?? unorderedMatch?.[1] ?? rawLine;
            const formattedParts = renderInlineMarkdown(lineBody, i);

            const isMetadata =
                trimmedLeft.startsWith('**Creator:**') ||
                trimmedLeft.startsWith('**Published:**') ||
                trimmedLeft.startsWith('**Description:**');

            const pClass = `leading-relaxed min-h-6 ${isMetadata ? 'text-gray-700 text-sm mt-1' : ''}`;

            return (
                <p key={i} className={pClass}>
                    {orderedMatch ? <span className="mr-2 font-medium text-gray-700">{orderedMatch[1]}.</span> : null}
                    {unorderedMatch ? <span className="mr-2 text-gray-500">•</span> : null}
                    {formattedParts}
                </p>
            );
        });
    };

    return (
        <div className="flex flex-col h-dvh bg-white overflow-hidden">
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
                                onClick={() => window.location.href = '/auth/login'}
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
                className="bg-white border-b border-gray-200 shrink-0 py-3 px-6 flex items-center justify-between shadow-sm z-10">
                <img
                    src={dataCommonsIconBlue}
                    alt="EOSC Logo"
                    className="h-8 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/')}
                />
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
                    <div className="p-4 border-b border-gray-200">
                        <button
                            onClick={() => {
                                setSelectedConversation(null);
                                if (urlId) navigate('/chat');
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
                                    <div
                                        key={convo.id}
                                        title={convo.title}
                                        className={`px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm wrap-break-word ${
                                            isActive
                                                ? 'bg-blue-100 text-blue-800 font-medium'
                                                : 'text-gray-700 hover:bg-gray-200'
                                        }`}
                                        onClick={() => handleSelectConversation(convo.id)}
                                    >
                                        {convo.title}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col bg-white min-w-0 relative">
                    {/* Header */}
                    {selectedConversation && (
                        <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
                            <h1 className="text-lg font-semibold text-gray-800 wrap-break-word line-clamp-2 md:line-clamp-none">
                                {conversations.find(c => c.id === selectedConversation.id)?.title || selectedConversation.title}
                            </h1>
                        </div>
                    )}

                    {/* Messages */}
                    <div
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 p-6 overflow-y-auto bg-gray-50"
                    >
                        <div className="max-w-6xl mx-auto space-y-6">
                            {!selectedConversation || selectedConversation.messages.length === 0 ? (
                                <div
                                    className="flex flex-col items-center justify-center h-full min-h-64 text-center mt-20">
                                    <div
                                        className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                        <MessageSquare className="h-8 w-8"/>
                                    </div>
                                    <h2 className="text-xl font-semibold text-gray-700 mb-2">Welcome to EOSC Chat</h2>
                                    <p className="text-gray-500 max-w-md">Start a new conversation by typing a message
                                        below
                                        to search datasets or ask questions.</p>
                                </div>
                            ) : (
                                selectedConversation.messages.map((msg, index) => (
                                    <div key={index}
                                         className={`w-full flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`group flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                                            {/* Avatar */}
                                            <div
                                                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm mt-1 overflow-hidden ${msg.sender === 'user' ? 'bg-[#002337] text-white text-sm font-medium' : 'bg-white border border-gray-100 p-1'}`}>
                                                {msg.sender === 'user' ? (
                                                    getInitials()
                                                ) : (
                                                    <img src={dataCommonsIconBlue} alt="Bot"
                                                         className="w-full h-full object-contain"/>
                                                )}
                                            </div>
                                            <div
                                                className={`rounded-2xl px-5 py-3 shadow-sm text-[15px] ${
                                                    msg.sender === 'user'
                                                        ? 'bg-blue-600 text-white rounded-tr-sm'
                                                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm whitespace-pre-wrap'
                                                }`}
                                            >
                                                {msg.sender === 'user' ? (
                                                    <p className="leading-relaxed">{msg.content}</p>
                                                ) : collapsedMessages.has(index) ? (
                                                    <div className="flex items-center gap-3">
                                                        <p className="text-gray-400 text-sm italic flex-1 truncate">
                                                            {getMessageSummary(msg.content)}
                                                            {msg.hits && msg.hits.length > 0 && (
                                                                <span
                                                                    className="ml-2 text-blue-400 font-medium not-italic">
                                                                    · {msg.hits.length} result{msg.hits.length !== 1 ? 's' : ''}
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
                                                        <button
                                                            onClick={() => toggleMessageCollapse(index)}
                                                            className="self-start text-xs text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
                                                            title="Collapse message"
                                                        >
                                                            <ChevronUp className="h-3 w-3"/>
                                                            <span>Collapse</span>
                                                        </button>
                                                        {msg.content && <div>{renderMessageContent(msg.content)}</div>}
                                                        {msg.hits && msg.hits.length > 0 && (
                                                            <div className="flex flex-col space-y-4 mt-2">
                                                                {msg.hits.map((hit: unknown, hitIdx: number) => (
                                                                    <SearchResultItem key={hitIdx}
                                                                                      hit={hit as BackendDataset}
                                                                                      isAiRanked={true}/>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            {/* Loading Indicator */}
                            {isSending && (
                                <div className="w-full flex justify-start">
                                    <div className="flex gap-3 max-w-[85%]">
                                        <div
                                            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm bg-white border border-gray-100 mt-1 p-1 overflow-hidden">
                                            <img src={dataCommonsIconBlue} alt="Bot"
                                                 className="w-full h-full object-contain animate-pulse"/>
                                        </div>
                                        <div
                                            className="rounded-2xl px-5 py-3 shadow-sm text-[15px] bg-white border border-gray-200 text-gray-500 rounded-tl-sm flex items-center gap-3">
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
                            <div ref={messagesEndRef}/>
                        </div>
                    </div>

                    {showScrollButton && (
                        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20">
                            <button
                                onClick={scrollToBottom}
                                className="p-2 bg-white border border-gray-200 shadow-md rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none flex items-center justify-center cursor-pointer"
                                title="Scroll to bottom"
                            >
                                <ChevronDown className="h-6 w-6"/>
                            </button>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-200">
                        <div className="max-w-6xl mx-auto">
                            <SearchInput
                                onSearch={handleSendMessage}
                                loading={isSending}
                                placeholder="Ask anything or search for datasets..."
                                clearOnSearch={true}
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
