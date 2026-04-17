import {FC, useState, useEffect} from "react";
import {useAuth} from "@/hooks/useAuth.ts";
import {Conversation} from "@/types/chat.ts";

const ChatPage: FC = () => {
    const {user} = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.sub) {
            fetch('/api/search/conversations')
                .then(res => res.json())
                .then(data => {
                    setConversations(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch conversations", err);
                    setLoading(false);
                });
        }
    }, [user?.sub]);

    const handleSelectConversation = (id: string) => {
        setLoading(true);
        fetch(`/api/search/conversation/${id}`)
            .then(res => res.json())
            .then(data => {
                setSelectedConversation(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch conversation", err);
                setLoading(false);
            });
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
                                    className="p-4 cursor-pointer hover:bg-gray-50"
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
                <div className="p-4 bg-white border-t border-gray-200">
                    <input
                        type="text"
                        placeholder="Type your message..."
                        className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
