import {useState} from 'react';
import {ThumbsUp, ThumbsDown} from 'lucide-react';
import useMatomo from '../hooks/useMatomo';

interface SearchFeedbackProps {
    query: string;
}

export const SearchFeedback = ({query}: SearchFeedbackProps) => {
    const [voted, setVoted] = useState<'up' | 'down' | null>(null);
    const {trackEvent} = useMatomo();

    const handleVote = (vote: 'up' | 'down') => {
        if (voted) return;
        setVoted(vote);
        trackEvent('Feedback', vote === 'up' ? 'thumbs_up' : 'thumbs_down', query);
    };

    if (voted) {
        return (
            <div className="mt-8 py-4 text-center text-sm text-gray-500">
                Thank you for your feedback!
            </div>
        );
    }

    return (
        <div
            className="mt-8 py-4 flex items-center justify-center gap-3 text-sm text-gray-500 border-t border-gray-200">
            <span>Were these results helpful?</span>
            <button
                type="button"
                onClick={() => handleVote('up')}
                aria-label="Yes, results were helpful"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors cursor-pointer"
            >
                <ThumbsUp className="h-4 w-4"/>
                Yes
            </button>
            <button
                type="button"
                onClick={() => handleVote('down')}
                aria-label="No, results were not helpful"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition-colors cursor-pointer"
            >
                <ThumbsDown className="h-4 w-4"/>
                No
            </button>
        </div>
    );
};
