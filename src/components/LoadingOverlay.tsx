import {LoaderIcon} from "lucide-react";

interface LoadingOverlayProps {
    show: boolean;
}

export const LoadingOverlay = ({show}: LoadingOverlayProps) => {
    if (!show) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-10 rounded-lg">
            <div className="flex items-center space-x-2 text-gray-700">
                <LoaderIcon className="h-6 w-6 animate-spin text-blue-600"/>
                <span className="text-sm sm:text-base">Searching datasets...</span>
            </div>
        </div>
    );
};

