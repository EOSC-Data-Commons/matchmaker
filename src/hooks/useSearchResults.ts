import {useState, useCallback, useRef} from 'react';
import {useNavigate} from 'react-router';
import type {BackendSearchResponse} from '../types/commons';
import {searchWithBackend} from '../lib/api';
import {addToSearchHistory} from '../lib/history';

interface UseSearchResultsReturn {
    initialResults: BackendSearchResponse | null;
    rerankedResults: BackendSearchResponse | null;
    loading: boolean;
    isProcessing: boolean;
    error: string | null;
    performSearch: () => Promise<void>;
}

export const useSearchResults = (query: string, model: string): UseSearchResultsReturn => {
    const navigate = useNavigate();
    const [initialResults, setInitialResults] = useState<BackendSearchResponse | null>(null);
    const [rerankedResults, setRerankedResults] = useState<BackendSearchResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
            setIsProcessing(false);
            setError(null);
            setInitialResults(null);
            setRerankedResults(null);

            await searchWithBackend(query, model, {
                onSearchData: (data) => {
                    setInitialResults(data);
                    console.log("Initial search data received:", data);
                    setLoading(false);
                    setIsProcessing(data.hits && data.hits.length > 0);
                },
                onRerankedData: (data) => {
                    setRerankedResults(data);
                },
                onError: (err) => {
                    console.error("Search stream error:", err);
                    setError(err.message);
                },
            });
            addToSearchHistory(query);
        } catch (err) {
            console.error("Search error:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setLoading(false);
            setIsProcessing(false);
            isSearchingRef.current = false;
        }
    }, [query, model, navigate]);

    return {
        initialResults,
        rerankedResults,
        loading,
        isProcessing,
        error,
        performSearch,
    };
};

