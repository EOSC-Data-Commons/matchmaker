import React, {FC} from 'react';
import {MoreVertical, Trash2} from 'lucide-react';
import {Conversation} from '@/types/chat.ts';

interface Props {
    conversation: Conversation;
    isActive: boolean;
    menuOpen: boolean;
    onClick: () => void;
    onMenuToggle: (e: React.MouseEvent) => void;
    onDeleteClick: (e: React.MouseEvent) => void;
}

export const ConversationSidebarItem: FC<Props> = ({
                                                       conversation,
                                                       isActive,
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
            <div className="flex-1 truncate pr-6" title={conversation.title}>
                {conversation.title}
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                <button
                    type="button"
                    onClick={onMenuToggle}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className={`p-1.5 rounded-md hover:bg-gray-300 transition-colors cursor-pointer ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isActive ? 'hover:bg-blue-200' : ''}`}
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

