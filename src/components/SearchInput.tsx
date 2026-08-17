import React, {useEffect, useRef, useState} from "react";
import {Search, Sparkles, X} from "lucide-react";
import {ModelSelector} from "./ModelSelector.tsx";
import {getSearchHistory} from "../lib/history.ts";
import {loginWithReturn} from "../lib/authRedirect.ts";
import useMatomo from "../hooks/useMatomo";
import {useMediaQuery} from "../hooks/useMediaQuery.ts";


const SHOW_MODEL_SELECTOR = import.meta.env.VITE_SHOW_MODEL_SELECTOR === 'true';

const DEFAULT_MODEL = "cesnet/agentic";

const models = [
    "openai/gpt-4.1",
    "mistralai/mistral-large-latest",
    "groq/moonshotai/kimi-k2-instruct",
    "cesnet/agentic",
    "cesnet/coder",
    "cesnet/mini",
    "cesnet/thinker"
];

interface SearchInputProps {
    initialQuery?: string;
    initialModel?: string;
    onSearch: (query: string, model: string, aiMode?: boolean) => void;
    loading?: boolean;
    placeholder?: string;
    // Used below `sm`, where the field is too narrow for the full placeholder.
    placeholderShort?: string;
    className?: string;
    clearOnSearch?: boolean;
    buttonText?: React.ReactNode;
    disableHistory?: boolean;
    isLoggedIn?: boolean;
    showAiToggle?: boolean;
    // Whether AI mode starts on. The landing page opts into it; the plain results
    // page starts off, since being there already means the user chose plain search.
    initialAiMode?: boolean;
    inputRef?: React.Ref<HTMLInputElement>;
}

export const SearchInput = ({
                                initialQuery = '',
                                onSearch,
                                loading = false,
                                placeholder = "Search for data... e.g., 'climate data for the last decade'",
                                placeholderShort = "Search for data...",
                                className = "",
                                initialModel,
                                clearOnSearch = false,
                                buttonText = "Search",
                                disableHistory = false,
                                isLoggedIn = false,
                                showAiToggle = false,
                                initialAiMode = true,
                                inputRef
                            }: SearchInputProps) => {
    const [query, setQuery] = useState(initialQuery);
    const [selectedModel, setSelectedModel] = useState(initialModel || DEFAULT_MODEL);
    const [showHistory, setShowHistory] = useState(false);
    const [history] = useState<string[]>(getSearchHistory);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [aiMode, setAiMode] = useState(initialAiMode);
    const [focused, setFocused] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const {trackEvent} = useMatomo();

    const effectiveAiMode = isLoggedIn && aiMode;

    // The leading icon and the submit button leave ~190px for text on a phone,
    // which truncates the full placeholders mid-phrase.
    const isNarrow = useMediaQuery('(max-width: 639px)');
    const effectivePlaceholder = effectiveAiMode
        ? (isNarrow ? "Ask about datasets..." : "Ask a question about datasets...")
        : (isNarrow ? placeholderShort : placeholder);

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
        if (loading) return;
        if (query.trim()) {
            trackEvent('Search', 'submitted', query.trim());
            onSearch(query.trim(), selectedModel, effectiveAiMode);
            setShowHistory(false);
            if (clearOnSearch) {
                setQuery('');
            }
        }
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (loading && e.key === 'Enter') {
            e.preventDefault();
            return;
        }

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
        if (loading) return;
        setQuery(item);
        trackEvent('Search', 'submitted', item);
        onSearch(item, selectedModel, effectiveAiMode);
        setShowHistory(false);
        setHighlightedIndex(-1);
        if (clearOnSearch) {
            setQuery('');
        }
    };

    // Logged-out users get sent to login rather than a dead disabled control, so the
    // chip explains what AI mode is worth instead of just refusing the click.
    const handleAiModeClick = () => {
        if (!isLoggedIn) {
            trackEvent('Auth', 'gate_triggered', 'ai_mode');
            loginWithReturn();
            return;
        }
        const next = !aiMode;
        setAiMode(next);
        trackEvent('Search', 'ai_mode_toggled', next ? 'on' : 'off');
    };

    const filteredHistory = disableHistory ? [] : history.filter(item => item.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className={`relative ${className}`} ref={searchContainerRef}>
            <form onSubmit={handleSearch}>
                {/* Single-surface bar holding the query, the AI toggle and submit. Radius
                    matches the app's cards and panels (rounded-xl) rather than a full pill. */}
                <div
                    className={`flex items-center gap-2 h-14 pl-4 pr-2 rounded-xl bg-white border transition-colors ${
                        focused
                            ? 'border-blue-500 ring-2 ring-blue-500/20'
                            : 'border-gray-200 shadow-sm hover:border-gray-300'
                    }`}
                >
                    <Search className="h-5 w-5 shrink-0 text-gray-400"/>

                    <input
                        type="text"
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            setFocused(true);
                            setShowHistory(true);
                        }}
                        onBlur={() => setFocused(false)}
                        placeholder={effectivePlaceholder}
                        className="flex-1 min-w-0 h-full bg-transparent text-base text-gray-800 placeholder:text-gray-500 font-light focus:outline-none"
                    />

                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Clear search"
                            className="shrink-0 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                            <X className="h-4 w-4"/>
                        </button>
                    )}

                    {SHOW_MODEL_SELECTOR && (
                        <div className="shrink-0 w-32">
                            <ModelSelector
                                models={models}
                                selectedModel={selectedModel}
                                onModelChange={setSelectedModel}
                            />
                        </div>
                    )}

                    {showAiToggle && (
                        <>
                            <span className="shrink-0 h-6 w-px bg-gray-200"/>
                            <div className="relative group shrink-0">
                                <button
                                    type="button"
                                    onClick={handleAiModeClick}
                                    aria-pressed={effectiveAiMode}
                                    aria-label="Toggle AI mode"
                                    className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                                        effectiveAiMode
                                            ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                                            : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <Sparkles className="h-4 w-4"/>
                                    <span className="hidden sm:inline">AI Mode</span>
                                </button>

                                {!isLoggedIn && (
                                    <div
                                        className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                        Sign in to use AI mode
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="shrink-0 flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {buttonText}
                    </button>
                </div>

                {!disableHistory && showHistory && filteredHistory.length > 0 && (
                    <div
                        className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <ul className="py-2">
                            {filteredHistory.map((item, index) => (
                                <li
                                    key={index}
                                    className={`flex items-center gap-3 px-5 py-2 cursor-pointer text-gray-700 hover:bg-gray-50 ${highlightedIndex === index ? 'bg-gray-50' : ''}`}
                                    onClick={() => handleHistoryItemClick(item)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                >
                                    <Search className="h-4 w-4 shrink-0 text-gray-400"/>
                                    <span className="truncate">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </form>
        </div>
    );
};
