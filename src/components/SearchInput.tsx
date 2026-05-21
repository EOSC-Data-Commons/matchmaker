import React, {useEffect, useRef, useState} from "react";
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

interface SearchInputProps {
    initialQuery?: string;
    initialModel?: string;
    onSearch: (query: string, model: string, aiMode?: boolean) => void;
    loading?: boolean;
    placeholder?: string;
    className?: string;
    clearOnSearch?: boolean;
    buttonText?: React.ReactNode;
    disableHistory?: boolean;
    isLoggedIn?: boolean;
    showAiToggle?: boolean;
}

export const SearchInput = ({
                                initialQuery = '',
                                onSearch,
                                loading = false,
                                placeholder = "Search for data... e.g., 'climate data for the last decade'",
                                className = "",
                                initialModel,
                                clearOnSearch = false,
                                buttonText = "Search",
                                disableHistory = false,
                                isLoggedIn = false,
                                showAiToggle = false
                            }: SearchInputProps) => {
    const [query, setQuery] = useState(initialQuery);
    const [selectedModel, setSelectedModel] = useState(initialModel || DEFAULT_MODEL);
    const [showHistory, setShowHistory] = useState(false);
    const [history] = useState<string[]>(getSearchHistory);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [aiMode, setAiMode] = useState(true);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    useNavigate();

    const effectiveAiMode = isLoggedIn && aiMode;

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
            onSearch(query.trim(), selectedModel, effectiveAiMode);
            setShowHistory(false);
            if (clearOnSearch) {
                setQuery('');
            }
        }
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!disableHistory && showHistory && filteredHistory.length > 0) {
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
        onSearch(item, selectedModel, effectiveAiMode);
        setShowHistory(false);
        setHighlightedIndex(-1);
        if (clearOnSearch) {
            setQuery('');
        }
    };

    const filteredHistory = disableHistory ? [] : history.filter(item => item.toLowerCase().includes(query.toLowerCase()));

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
                        placeholder={effectiveAiMode ? "Ask a question about datasets..." : placeholder}
                        className={`truncate w-full h-16 px-4 text-lg text-eosc-gray font-light rounded-xl border-2 border-eosc-border bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-eosc-light-blue focus:border-eosc-light-blue ${SHOW_MODEL_SELECTOR ? 'pr-64' : 'pr-32'}`}
                    />
                    {!disableHistory && showHistory && filteredHistory.length > 0 && (
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
                        <div className="absolute right-32 top-3 w-32">
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
                        className="absolute right-2 top-2 px-4 min-w-[6rem] h-12 bg-blue-600 text-white text-lg font-light rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {buttonText}
                    </button>
                </div>

                {showAiToggle && (
                    <div className="flex items-center gap-2.5 mt-3 ml-2">
                        <span
                            className={`inline-flex items-center justify-center h-6 text-xs font-medium px-2.5 rounded-full tracking-wide ${effectiveAiMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}>
                            ✦ AI mode
                        </span>

                        <div className="relative group flex items-center justify-center">
                            <button
                                type="button"
                                onClick={() => isLoggedIn && setAiMode(v => !v)}
                                disabled={!isLoggedIn}
                                aria-label="Toggle AI mode"
                                className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${effectiveAiMode ? 'bg-blue-600' : 'bg-gray-300'} ${!isLoggedIn ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <span
                                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${effectiveAiMode ? 'left-[22px]' : 'left-0.5'}`}/>
                            </button>

                            {!isLoggedIn && (
                                <div
                                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    Sign in to use AI mode
                                </div>
                            )}
                        </div>

                        <span
                            className={`inline-flex items-center justify-center h-6 text-xs font-medium px-2.5 rounded-full ${effectiveAiMode ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                            {effectiveAiMode ? 'on' : 'off'}
                        </span>

                        {!isLoggedIn && (
                            <a href="/auth/login"
                               className="inline-flex items-center h-6 text-xs text-blue-600 hover:text-blue-700 hover:underline ml-1">
                                Sign in to unlock
                            </a>
                        )}
                    </div>
                )}
            </form>
        </div>
    );
};
