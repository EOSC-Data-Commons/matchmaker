import {FC} from 'react';
import {Trash2} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const DeleteConversationDialog: FC<Props> = ({isOpen, onClose, onConfirm}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center border border-gray-100">
                <div
                    className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="h-6 w-6"/>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Delete Chat?</h2>
                <p className="text-gray-600 mb-6 text-sm">
                    Are you sure you want to delete this conversation? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

