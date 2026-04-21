import {FC, useState, useEffect, useCallback, Fragment} from "react";
import {useNavigate, useParams} from "react-router";
import {useAuth} from "@/hooks/useAuth.ts";
import {Conversation, Message} from "@/types/chat.ts";
import {BackendDataset} from "@/types/commons.ts";
import {sendChatMessage} from "@/lib/api.ts";
import {stripHtml} from "@/lib/utils.ts";
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import {Footer} from "@/components/Footer.tsx";
import {Plus, MessageSquare, User, Bot, Send, Loader2, Copy, Check} from "lucide-react";

const ChatPage: FC = () => {
    const {id: urlId} = useParams();
    const navigate = useNavigate();
    const {user, loading: userLoading} = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const fetchConversations = useCallback(() => {
        if (user?.sub) {
            fetch('/api/search/conversations')
                .then(res => res.json())
                .then(data => {
                    const mapped_data = data.map((item: Record<string, string>) => ({
                        id: item.thread_id || item.id,
                        title: item.label || item.title,
                        ...item
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
            .then(res => res.json())
            .then(data => {
                const parsedMessages: Message[] = [];
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach((item: Record<string, unknown>) => {
                        if (item.type === 'message' && item.role === 'user') {
                            const contentObj = Array.isArray(item.content) && item.content[0] as Record<string, unknown>;
                            const text = Array.isArray(item.content) && contentObj?.text
                                ? String(contentObj.text)
                                : typeof item.content === 'string' ? item.content : '';
                            parsedMessages.push({sender: 'user', content: text});
                        } else if (item.type === 'tool_result' && (item.call_id === 'rerank_results' || (item.metadata as Record<string, unknown>)?.name === 'rerank_results')) {
                            try {
                                const contentObj = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
                                if (contentObj && contentObj.summary && contentObj.hits) {
                                    const {summary, hits} = contentObj;
                                    let formattedContent = summary + "\n\n";
                                    hits.forEach((rawHit: Record<string, unknown>, index: number) => {
                                        const hit = rawHit as unknown as BackendDataset;
                                        const title = hit.title || hit._source?.titles?.[0]?.title || 'Unknown Dataset';
                                        const url = hit._id || hit._source?.doi || '#';
                                        let description = hit.description || hit._source?.descriptions?.[0]?.description || '';
                                        if (typeof description === 'string') description = stripHtml(description);
                                        const creator = hit.creator || (hit._source?.creators ? hit._source.creators.map(c => c.creatorName).filter(Boolean).join(', ') : '');
                                        const date = hit.publication_date || hit._source?.publicationYear || '';

                                        formattedContent += `${index + 1}. [${title}](${url})\n`;
                                        if (creator) formattedContent += `   **Creator:** ${creator}\n`;
                                        if (date) formattedContent += `   **Published:** ${date}\n`;
                                        if (description) {
                                            const truncDesc = description.length > 250 ? description.substring(0, 250) + '...' : description;
                                            formattedContent += `   **Description:** ${truncDesc}\n`;
                                        }
                                        formattedContent += '\n';
                                    });
                                    parsedMessages.push({sender: 'bot', content: formattedContent});
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
            handleSelectConversation(urlId);
        } else {
            setSelectedConversation(null);
        }
    }, [urlId, handleSelectConversation]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        const userMessage: Message = {sender: 'user', content: newMessage};

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
        setNewMessage("");
        setIsSending(true);

        try {
            let currentTextContent = "";
            let receivedRerank = false;

            await sendChatMessage(
                updatedMessages,
                'einfracz/qwen3-coder',
                (event) => {
                    if (event.type === 'TOOL_CALL_RESULT' && event.tool_call_id === 'rerank_results' && event.content) {
                        receivedRerank = true;
                        const result = JSON.parse(event.content);
                        const {summary, hits} = result;

                        let formattedContent = summary + "\n\n";
                        hits.forEach((rawHit: unknown, index: number) => {
                            const hit = rawHit as BackendDataset;
                            const title = hit.title || hit._source?.titles?.[0]?.title || 'Unknown Dataset';
                            const url = hit._id || hit._source?.doi || '#';
                            let description = hit.description || hit._source?.descriptions?.[0]?.description || '';
                            if (typeof description === 'string') description = stripHtml(description);
                            const creator = hit.creator || (hit._source?.creators ? hit._source.creators.map(c => c.creatorName).filter(Boolean).join(', ') : '');
                            const date = hit.publication_date || hit._source?.publicationYear || '';

                            formattedContent += `${index + 1}. [${title}](${url})\n`;
                            if (creator) formattedContent += `**Creator:** ${creator}\n`;
                            if (date) formattedContent += `**Published:** ${date}\n`;
                            if (description) {
                                const truncDesc = description.length > 500 ? description.substring(0, 500) + '...' : description;
                                formattedContent += `**Description:** ${truncDesc}\n`;
                            }
                            formattedContent += '\n';
                        });

                        const botMessage: Message = {sender: 'bot', content: formattedContent};

                        setSelectedConversation(prev => {
                            if (!prev) return null;
                            return {...prev, messages: [...prev.messages, botMessage]};
                        });
                        setIsSending(false);
                    } else if (event.type === 'TEXT_MESSAGE_CHUNK' && event.delta) {
                        currentTextContent += event.delta;
                    } else if (event.type === 'TEXT_MESSAGE_END') {
                        if (currentTextContent.trim() && !receivedRerank) {
                            const botMessage: Message = {sender: 'bot', content: currentTextContent};
                            setSelectedConversation(prev => {
                                if (!prev) return null;
                                return {...prev, messages: [...prev.messages, botMessage]};
                            });
                        }
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

    const renderMessageContent = (content: string) => {
        const lines = content.split('\n');
        return lines.map((line, i) => {
            const linkRegex = /\[(.*?)\]\((.*?)\)/g;
            const parts = [];
            let lastIndex = 0;
            let match;
            let keyIndex = 0;
            while ((match = linkRegex.exec(line)) !== null) {
                parts.push(line.substring(lastIndex, match.index));
                parts.push(
                    <a key={`${i}-${keyIndex++}`} href={match[2]} target="_blank" rel="noopener noreferrer"
                       className="text-blue-500 hover:text-blue-700 underline font-medium break-all">
                        {match[1]}
                    </a>
                );
                lastIndex = match.index + match[0].length;
            }
            parts.push(line.substring(lastIndex));

            // Process **bold** text within text parts
            const formattedParts = parts.map((part, pIdx) => {
                if (typeof part !== 'string') return part;
                const boldRegex = /\*\*(.*?)\*\*/g;
                const subParts = [];
                let bLastIndex = 0;
                let bMatch;
                let bKeyIndex = 0;
                while ((bMatch = boldRegex.exec(part)) !== null) {
                    subParts.push(part.substring(bLastIndex, bMatch.index));
                    subParts.push(<strong key={`b-${pIdx}-${bKeyIndex++}`}
                                          className="font-semibold text-gray-900">{bMatch[1]}</strong>);
                    bLastIndex = bMatch.index + bMatch[0].length;
                }
                subParts.push(part.substring(bLastIndex));
                return <Fragment key={`p-${pIdx}`}>{subParts.map((sp, idx) => <Fragment
                    key={idx}>{sp}</Fragment>)}</Fragment>;
            });

            // Handle indentation for list details
            const hasLeadingSpaces = line.startsWith('   ');
            const pClass = `leading-relaxed min-h-6 ${hasLeadingSpaces ? 'pl-4 text-gray-700 text-sm mt-1' : ''}`;

            return (
                <p key={i} className={pClass}>
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
                                        className={`px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm line-clamp-2 break-words ${
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
                <div className="flex-1 flex flex-col bg-white min-w-0">
                    {/* Header */}
                    {selectedConversation && (
                        <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
                            <h1 className="text-lg font-semibold text-gray-800 wrap-break-word line-clamp-2 md:line-clamp-none">{selectedConversation.title}</h1>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                        <div className="max-w-4xl mx-auto space-y-6">
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
                                                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm mt-1 ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-blue-600 border border-gray-200'}`}>
                                                {msg.sender === 'user' ? (
                                                    <User className="h-5 w-5"/>
                                                ) : (
                                                    <Bot className="h-5 w-5"/>
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
                                                ) : (
                                                    renderMessageContent(msg.content)
                                                )}
                                            </div>
                                            <div
                                                className={`flex items-end mb-2 opacity-0 group-hover:opacity-100 transition-opacity ${msg.sender === 'user' ? 'mr-1' : 'ml-1'}`}>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(msg.content);
                                                        setCopiedIndex(index);
                                                        setTimeout(() => setCopiedIndex(null), 2000);
                                                    }}
                                                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                                                    title="Copy message"
                                                >
                                                    {copiedIndex === index ?
                                                        <Check className="h-4 w-4 text-green-600"/> :
                                                        <Copy className="h-4 w-4"/>}
                                                </button>
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
                                            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm bg-gray-100 text-blue-600 border border-gray-200 mt-1">
                                            <Bot className="h-5 w-5 animate-pulse"/>
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
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-200">
                        <div className="max-w-4xl mx-auto relative flex items-end gap-3">
                        <textarea
                            rows={1}
                            placeholder="Ask anything or search for datasets..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-32 overflow-y-auto bg-gray-50 text-gray-800 shadow-sm"
                            value={newMessage}
                            disabled={isSending}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !isSending) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />
                            <button
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || isSending}
                                className={`px-5 py-3 rounded-xl font-medium transition-colors shadow-sm flex items-center justify-center h-12.5 ${
                                    newMessage.trim() && !isSending
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {isSending ? (
                                    <Loader2 className="animate-spin h-5 w-5 sm:mr-2"/>
                                ) : (
                                    <Send className="h-5 w-5 hidden sm:block sm:mr-2"/>
                                )}
                                {isSending ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                        <div className="max-w-4xl mx-auto text-center mt-3 text-xs text-gray-400">
                            AI-generated content may be incomplete or occasionally incorrect. Please verify critical
                            data.
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.1)] z-10 w-full relative">
                <Footer className="mt-0! py-4! scale-[0.85] origin-bottom overflow-hidden" translucent={false}/>
            </div>
        </div>
    );
};

export default ChatPage;
