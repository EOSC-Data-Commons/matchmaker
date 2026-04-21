import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router";
import {ModelSelector} from "./ModelSelector.tsx";
import {getSearchHistory} from "../lib/history.ts";


const SHOW_MODEL_SELECTOR = import.meta.env.VITE_SHOW_MODEL_SELECTOR === 'true';

const DEFAULT_MODEL = "einfracz/qwen3-coder";

const models = [
    "openai/gpt-4.1",
    "mistralai/mistral-large-latest",
    "groq/moonshotai/kimi-k2-instruct",
    "einfracz/qwen3-coder",
    "einfracz/gpt-oss-120b",
    "einfracz/deepseek-v3.2-thinking"
];

interface PlayInputProps {
    initialQuery?: string;
    initialModel?: string;
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
    initialModel
}: PlayInputProps) => {
    const [query, setQuery] = useState(initialQuery);
    const [selectedModel, setSelectedModel] = useState(initialModel || DEFAULT_MODEL);
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
                        className={`truncate w-full h-16 px-4 text-lg text-eosc-gray font-light rounded-xl border-2 border-eosc-border bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-eosc-light-blue focus:border-eosc-light-blue ${SHOW_MODEL_SELECTOR ? 'pr-64' : 'pr-32'}`}
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
                    {SHOW_MODEL_SELECTOR && (
                        <div className="absolute right-28 top-3 w-32">
                            <ModelSelector
                                models={models}
                                selectedModel={selectedModel}
                                onModelChange={setSelectedModel}
                            />
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
