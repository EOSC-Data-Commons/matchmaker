import {FC, useState, useEffect, useCallback} from "react";
import {useNavigate, useParams} from "react-router";
import {useAuth} from "@/hooks/useAuth.ts";
import {Conversation, Message} from "@/types/chat.ts";
import {BackendDataset} from "@/types/commons.ts";
import {sendChatMessage} from "@/lib/api.ts";
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import {Footer} from "@/components/Footer.tsx";

const ChatPage: FC = () => {
    const {id: urlId} = useParams();
    const navigate = useNavigate();
    const {user} = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);

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
                                    hits.forEach((hit: Record<string, unknown>, index: number) => {
                                        const title = hit.title || (hit._source as Record<string, unknown> | undefined)?.titles?.[0]?.title || 'Unknown Dataset';
                                        const url = hit._id || (hit._source as Record<string, unknown> | undefined)?.doi || '#';
                                        formattedContent += `${index + 1}. [${title}](${url})\n`;
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
            await sendChatMessage(
                updatedMessages,
                'einfracz/qwen3-coder',
                (event) => {
                    if (event.type === 'TOOL_CALL_RESULT' && event.tool_call_id === 'rerank_results' && event.content) {
                        const result = JSON.parse(event.content);
                        const {summary, hits} = result;

                        let formattedContent = summary + "\n\n";
                        hits.forEach((hit: BackendDataset, index: number) => {
                            const title = hit.title || 'Unknown Dataset';
                            const url = hit._id || '#';
                            formattedContent += `${index + 1}. [${title}](${url})\n`;
                        });

                        const botMessage: Message = {sender: 'bot', content: formattedContent};

                        setSelectedConversation(prev => {
                            if (!prev) return null;
                            return {...prev, messages: [...prev.messages, botMessage]};
                        });
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
                       className="text-blue-500 hover:text-blue-700 underline font-medium">
                        {match[1]}
                    </a>
                );
                lastIndex = match.index + match[0].length;
            }
            parts.push(line.substring(lastIndex));
            return (
                <p key={i} className="leading-relaxed min-h-[1.5rem]">
                    {parts}
                </p>
            );
        });
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-white overflow-hidden">
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20"
                             fill="currentColor">
                            <path fillRule="evenodd"
                                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                  clipRule="evenodd"/>
                        </svg>
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
                                    className={`px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm truncate ${
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
            <div className="flex-1 flex flex-col bg-white">
                {/* Header */}
                {selectedConversation && (
                    <div className="px-6 py-4 border-b border-gray-100 bg-white">
                        <h1 className="text-lg font-semibold text-gray-800">{selectedConversation.title}</h1>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {!selectedConversation || selectedConversation.messages.length === 0 ? (
                            <div
                                className="flex flex-col items-center justify-center h-full min-h-[16rem] text-center mt-20">
                                <div
                                    className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none"
                                         viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                                    </svg>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-700 mb-2">Welcome to EOSC Chat</h2>
                                <p className="text-gray-500 max-w-md">Start a new conversation by typing a message below
                                    to search datasets or ask questions.</p>
                            </div>
                        ) : (
                            selectedConversation.messages.map((msg, index) => (
                                <div key={index}
                                     className={`w-full flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                                        {/* Avatar */}
                                        <div
                                            className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm mt-1 ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-blue-600 border border-gray-200'}`}>
                                            {msg.sender === 'user' ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"
                                                     viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd"
                                                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                                          clipRule="evenodd"/>
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"
                                                     viewBox="0 0 20 20" fill="currentColor">
                                                    <path
                                                        d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                                                </svg>
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
                                    </div>
                                </div>
                            ))
                        )}
                        {/* Loading Indicator */}
                        {isSending && (
                            <div className="w-full flex justify-start">
                                <div className="flex gap-3 max-w-[85%]">
                                    <div
                                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm bg-gray-100 text-blue-600 border border-gray-200 mt-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-pulse"
                                             viewBox="0 0 20 20" fill="currentColor">
                                            <path
                                                d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                                        </svg>
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
                            className={`px-5 py-3 rounded-xl font-medium transition-colors shadow-sm flex items-center justify-center h-[50px] ${
                                newMessage.trim() && !isSending
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isSending ? (
                                <svg className="animate-spin h-5 w-5 sm:mr-2" xmlns="http://www.w3.org/2000/svg"
                                     fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                            strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor"
                                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 hidden sm:block sm:mr-2"
                                     viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                                          clipRule="evenodd"/>
                                </svg>
                            )}
                            {isSending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                    <div className="max-w-4xl mx-auto text-center mt-3 text-xs text-gray-400">
                        AI-generated content may be incomplete or occasionally incorrect. Please verify critical data.
                    </div>
                </div>
            </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.1)] z-10 w-full relative">
                <Footer className="!mt-0 !py-4 scale-[0.85] origin-bottom overflow-hidden" translucent={false}/>
            </div>
        </div>
    );
};

export default ChatPage;
