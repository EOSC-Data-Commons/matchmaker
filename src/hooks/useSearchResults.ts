import {useState, useCallback, useRef} from 'react';
import {useNavigate} from 'react-router';
import type {SearchResults} from '../types/commons';
import {searchDatasets} from '../lib/api';
import {addToSearchHistory} from '../lib/history';

interface UseSearchResultsReturn {
    results: SearchResults | null;
    loading: boolean;
    error: Error | null;
    performSearch: () => Promise<void>;
}

/**
 * Drives the plain (non-AI) results page off `GET /search`. An empty result set
 * is a normal outcome here, not an error — the page renders its no-results view
 * from `results.hits` being empty.
 */
export const useSearchResults = (query: string): UseSearchResultsReturn => {
    const navigate = useNavigate();
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(true);
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
            setError(null);
            setResults(null);

            setResults(await searchDatasets(query));
            addToSearchHistory(query);
        } catch (err) {
            console.error("Search error:", err);
            setError(err instanceof Error ? err : new Error("An unknown error occurred."));
        } finally {
            setLoading(false);
            isSearchingRef.current = false;
        }
    }, [query, navigate]);

    return {
        results,
        loading,
        error,
        performSearch,
    };
};
