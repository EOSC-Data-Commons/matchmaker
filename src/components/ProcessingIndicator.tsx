import {LoaderIcon, Sparkles} from "lucide-react";

interface ProcessingIndicatorProps {
    show: boolean;
}

export const ProcessingIndicator = ({show}: ProcessingIndicatorProps) => {
    if (!show) return null;

    return (
        <div
            className="mb-6 p-4 bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-300 animate-pulse">
            <div className="flex items-center space-x-3 text-blue-700">
                <Sparkles className="h-5 w-5 animate-pulse"/>
                <span className="text-sm font-medium">AI is analyzing and reranking results...</span>
                <LoaderIcon className="h-4 w-4 animate-spin"/>
            </div>
        </div>
    );
};

