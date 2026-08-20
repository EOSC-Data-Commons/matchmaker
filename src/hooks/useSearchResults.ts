import {useState, useCallback, useRef} from 'react';
import {useNavigate} from 'react-router';
import type {SearchResults} from '../types/commons';
import {searchDatasets} from '../lib/api';
import {addToSearchHistory} from '../lib/history';
import {errorKind} from '../lib/analytics';
import useMatomo from './useMatomo';

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
    const {trackEvent} = useMatomo();
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

            const startedAt = Date.now();
            const searchResults = await searchDatasets(query);
            const elapsedMs = Date.now() - startedAt;

            setResults(searchResults);
            addToSearchHistory(query);

            // Outcome, not just intent: 'submitted' is fired by SearchInput, so
            // pairing it with these gives the success/zero/error breakdown.
            const hitCount = searchResults.hits?.length ?? 0;
            trackEvent('Search', 'results_returned', query, hitCount);
            trackEvent('Search', 'latency_ms', query, elapsedMs);
            if (hitCount === 0) trackEvent('Search', 'zero_results', query);
        } catch (err) {
            console.error("Search error:", err);
            trackEvent('Search', 'error', errorKind(err));
            setError(err instanceof Error ? err : new Error("An unknown error occurred."));
        } finally {
            setLoading(false);
            isSearchingRef.current = false;
        }
    }, [query, navigate, trackEvent]);

    return {
        results,
        loading,
        error,
        performSearch,
    };
};
