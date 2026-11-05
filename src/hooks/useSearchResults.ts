import {useState, useCallback, useRef} from 'react';
import {useNavigate} from 'react-router';
import type {SearchResults} from '../types/commons';
import {searchDatasets} from '../lib/api';
import {addToSearchHistory} from '../lib/history';
import {errorKind, trackPageView, trackSiteSearch} from '../lib/analytics';
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
 *
 * `model` is only reported, as the name of `Search/completed`: the plain search
 * endpoint does not take one, so it is the page's selection, not a request field.
 */
export const useSearchResults = (query: string, model: string = 'cesnet/agentic'): UseSearchResultsReturn => {
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

            // The action for this navigation. Matomo already counts /search?q= as
            // a site search via its own `q` detection, but cannot know the hit
            // count that way, so MatomoTracker holds the pageview back and this
            // reports the search with the count attached. The keyword and the
            // zero-result cases live in the Site Search reports from this call.
            const hitCount = searchResults.hits?.length ?? 0;
            trackSiteSearch(query, 'search', hitCount);
            // Outcome, not just intent: pairs with the page's 'submitted' to give
            // the success/failure breakdown, with the latency as the value.
            trackEvent('Search', 'completed', model, elapsedMs);
        } catch (err) {
            console.error("Search error:", err);
            trackEvent('Search', 'failed', errorKind(err));
            // A failed search has no meaningful hit count, and reporting zero
            // would file it under no-result keywords. The suppressed pageview is
            // sent instead, which Matomo still detects as a search from `q`.
            trackPageView();
            setError(err instanceof Error ? err : new Error("An unknown error occurred."));
        } finally {
            setLoading(false);
            isSearchingRef.current = false;
        }
    }, [query, model, navigate, trackEvent]);

    return {
        results,
        loading,
        error,
        performSearch,
    };
};
