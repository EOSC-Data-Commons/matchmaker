import {useState, useCallback, useRef} from 'react';
import {useNavigate} from 'react-router';
import type {SearchResults} from '../types/commons';
import {searchWithBackend} from '../lib/api';
import {addToSearchHistory} from '../lib/history';

interface UseSearchResultsReturn {
    results: SearchResults | null;
    // The assistant's summary of the results, accumulated as it streams in.
    summary: string;
    loading: boolean;
    // True once the results are in while the summary is still streaming.
    isSummarizing: boolean;
    error: Error | null;
    performSearch: () => Promise<void>;
}

export const useSearchResults = (query: string, model: string): UseSearchResultsReturn => {
    const navigate = useNavigate();
    const [results, setResults] = useState<SearchResults | null>(null);
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const isSearchingRef = useRef(false);

    const performSearch = useCallback(async () => {
        if (isSearchingRef.current) return; // Prevent concurrent searches
        isSearchingRef.current = true;
        try {
            if (!query) {
                navigate('/');
                return;
            }

            setLoading(true);
            setIsSummarizing(false);
            setError(null);
            setResults(null);
            setSummary('');

            await searchWithBackend(query, model, {
                onSearchData: (data) => {
                    setResults(data);
                    setLoading(false);
                    setIsSummarizing(data.hits.length > 0);
                },
                onSummaryDelta: (delta) => {
                    setSummary(prev => prev + delta);
                },
                onError: (err) => {
                    console.error("Search stream error:", err);
                    setError(err);
                },
            });
            addToSearchHistory(query);
        } catch (err) {
            console.error("Search error:", err);
            setError(err instanceof Error ? err : new Error("An unknown error occurred."));
        } finally {
            setLoading(false);
            setIsSummarizing(false);
            isSearchingRef.current = false;
        }
    }, [query, model, navigate]);

    return {
        results,
        summary,
        loading,
        isSummarizing,
        error,
        performSearch,
    };
};
