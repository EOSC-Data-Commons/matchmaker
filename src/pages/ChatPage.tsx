import {FC, useState, useEffect, useCallback} from "react";
import {useNavigate, useParams} from "react-router";
import {useAuth} from "@/hooks/useAuth.ts";
import {Conversation, Message} from "@/types/chat.ts";
import {BackendDataset} from "@/types/commons.ts";
import {sendChatMessage} from "@/lib/api.ts";

const ChatPage: FC = () => {
    const {id: urlId} = useParams();
    const navigate = useNavigate();
    const {user} = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState("");

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
                                        formattedContent += `${index + 1}. ${hit.title || (hit._source as Record<string, unknown> | undefined)?.titles?.[0]?.title || 'Unknown Dataset'}\n`;
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

        await sendChatMessage(
            updatedMessages,
            'einfracz/qwen3-coder',
            (event) => {
                if (event.type === 'TOOL_CALL_RESULT' && event.tool_call_id === 'rerank_results' && event.content) {
                    const result = JSON.parse(event.content);
                    const {summary, hits} = result;

                    let formattedContent = summary + "\n\n";
                    hits.forEach((hit: BackendDataset, index: number) => {
                        formattedContent += `${index + 1}. ${hit.title}\n`;
                    });

                    const botMessage: Message = {sender: 'bot', content: formattedContent};

                    setSelectedConversation(prev => {
                        if (!prev) return null;
                        return {...prev, messages: [...prev.messages, botMessage]};
                    });
                }
            },
            (error) => {
                console.error("Failed to send message", error);
            }
        );
        fetchConversations();
    };

    return (
        <div className="flex h-screen bg-gray-100">
            <div className="w-1/4 bg-white border-r border-gray-200">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold">Conversations</h2>
                </div>
                <div className="overflow-y-auto">
                    {loading ? (
                        <p className="p-4">Loading conversations...</p>
                    ) : (
                        <ul>
                            {conversations.map(convo => (
                                <li
                                    key={convo.id}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 ${convo.id === selectedConversation?.id || convo.id === urlId ? 'bg-gray-100' : ''}`}
                                    onClick={() => handleSelectConversation(convo.id)}
                                >
                                    {convo.title}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            <div className="flex-1 flex flex-col">
                <div className="flex-1 p-4 overflow-y-auto">
                    {selectedConversation ? (
                        <div>
                            <h1 className="text-2xl font-bold mb-4">{selectedConversation.title}</h1>
                            <div>
                                {selectedConversation.messages.map((msg, index) => (
                                    <div key={index}
                                         className={`p-2 my-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-200'}`}>
                                        <p><strong>{msg.sender}:</strong> {msg.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">Select a conversation to start chatting.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-white border-t border-gray-200 flex">
                    <input
                        type="text"
                        placeholder="Type your message..."
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSendMessage();
                            }
                        }}
                    />
                    <button
                        onClick={handleSendMessage}
                        className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
