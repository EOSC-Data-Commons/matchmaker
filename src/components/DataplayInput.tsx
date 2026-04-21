import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router";
import {getSearchHistory} from "../lib/history.ts";



interface PlayInputProps {
    initialQuery?: string;
    onPlay: (query: string) => void;
    loading?: boolean;
    placeholder?: string;
    className?: string;
}

export const DataplayInput = ({
    initialQuery = '',
    onPlay,
    loading = false,
    placeholder = "Provide your dataset to play with, e.g. github, materials cloud.",
    className = "",
}: PlayInputProps) => {
    const [query, setQuery] = useState(initialQuery);
    const [showHistory, setShowHistory] = useState(false);
    const [history] = useState<string[]>(getSearchHistory);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    useNavigate();


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setShowHistory(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [searchContainerRef]);


    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onPlay(query.trim());
            setShowHistory(false);
        }
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showHistory && filteredHistory.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex(prevIndex =>
                    prevIndex < filteredHistory.length - 1 ? prevIndex + 1 : prevIndex
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex(prevIndex => (prevIndex > 0 ? prevIndex - 1 : 0));
            } else if (e.key === 'Enter') {
                if (highlightedIndex > -1) {
                    e.preventDefault();
                    handleHistoryItemClick(filteredHistory[highlightedIndex]);
                } else {
                    handleSearch(e as unknown as React.FormEvent);
                }
            }
        } else if (e.key === 'Enter') {
            handleSearch(e as unknown as React.FormEvent);
        }
    };

    const handleHistoryItemClick = (item: string) => {
        setQuery(item);
        onPlay(item);
        setShowHistory(false);
        setHighlightedIndex(-1);
    };

    const filteredHistory = history.filter(item => item.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className={`relative ${className}`} ref={searchContainerRef}>
            <form onSubmit={handleSearch}>
                <div className="relative">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setShowHistory(true)}
                        placeholder={placeholder}
                        className={`truncate w-full h-16 px-4 text-lg text-eosc-gray font-light rounded-xl border-2 border-eosc-border bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-eosc-light-blue focus:border-eosc-light-blue pr-32`}
                    />
                    {showHistory && filteredHistory.length > 0 && (
                        <div
                            className="absolute z-10 w-full mt-1 bg-white border border-eosc-border rounded-lg shadow-lg">
                            <ul>
                                {filteredHistory.map((item, index) => (
                                    <li
                                        key={index}
                                        className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${highlightedIndex === index ? 'bg-gray-100' : ''}`}
                                        style={{color: '#681da8'}}
                                        onClick={() => handleHistoryItemClick(item)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                    >
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="absolute right-2 top-2 w-24 h-12 bg-green-500 text-white text-lg font-light rounded-lg hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                        Play (tbd)
                    </button>
                </div>
            </form>
        </div>
    );
};
