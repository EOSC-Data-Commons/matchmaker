import {useEffect, useState} from "react";
import {getSearchHistory} from "../lib/history.ts";
import {HistoryIcon} from "lucide-react";

interface HistoryPanelProps {
    onHistoryClick: (item: string) => void;
}

export const HistoryPanel = ({onHistoryClick}: HistoryPanelProps) => {
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        setHistory(getSearchHistory());
    }, []);

    if (history.length === 0) {
        return null;
    }

    return (
        <div className="mt-8 text-center">
            <h3 className="text-lg font-semibold text-gray-600 mb-4 flex items-center justify-center gap-2">
                <HistoryIcon/> Recent Searches
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
                {history.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => onHistoryClick(item)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-blue-100 hover:text-blue-700 transition-colors text-sm"
                    >
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );
};