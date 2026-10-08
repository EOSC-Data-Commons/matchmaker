import React, {FC} from 'react';
import {Loader2, MoreVertical, Trash2} from 'lucide-react';
import {Conversation} from '@/types/chat.ts';

interface Props {
    conversation: Conversation;
    isActive: boolean;
    // `running`: an answer is still being written. `unread`: one finished while the
    // conversation was not open.
    activity?: 'running' | 'unread';
    menuOpen: boolean;
    onClick: () => void;
    onMenuToggle: (e: React.MouseEvent) => void;
    onDeleteClick: (e: React.MouseEvent) => void;
}

export const ConversationSidebarItem: FC<Props> = ({
                                                       conversation,
                                                       isActive,
                                                       activity,
                                                       menuOpen,
                                                       onClick,
                                                       onMenuToggle,
                                                       onDeleteClick
                                                   }) => {
    return (
        <div
            className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm wrap-break-word ${
                isActive
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'text-gray-700 hover:bg-gray-200'
            } ${menuOpen ? 'z-10' : 'z-0'}`}
            onClick={onClick}
        >
            <div className="flex-1 min-w-0 flex items-center gap-2 pr-6">
                {activity === 'running' && (
                    <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" aria-hidden="true"/>
                        <span className="sr-only">Answer in progress:</span>
                    </>
                )}
                {activity === 'unread' && (
                    <>
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-hidden="true"/>
                        <span className="sr-only">New answer:</span>
                    </>
                )}
                <span className="truncate" title={conversation.title}>{conversation.title}</span>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                <button
                    type="button"
                    onClick={onMenuToggle}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className={`p-1.5 rounded-md hover:bg-gray-300 transition-colors cursor-pointer ${menuOpen ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'} ${isActive ? 'hover:bg-blue-200' : ''}`}
                    title="Options"
                    aria-label="Conversation options"
                >
                    <MoreVertical className="h-4 w-4 text-gray-500"/>
                </button>

                {menuOpen && (
                    <div
                        role="menu"
                        className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-100 z-50 py-1"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            onClick={onDeleteClick}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                        >
                            <Trash2 className="h-4 w-4"/>
                            Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

