import {useMemo} from 'react';
import type {SearchResults, BackendDataset, Aggregations} from '../types/commons';
import {applyLocalFilters, generateDynamicFilters} from '../lib/localFilters';

interface UseDatasetFiltersReturn {
    // Hits left after applying the active filters — what the results list shows.
    datasets: BackendDataset[];
    // Facet counts, recalculated against the active filters.
    aggregations: Aggregations;
}

/**
 * Derives the filter facets and the filtered result list from a search response.
 */
export const useDatasetFilters = (
    results: SearchResults | null,
    activeFilters: URLSearchParams
): UseDatasetFiltersReturn => {
    const hits = useMemo(() => results?.hits ?? [], [results]);

    const aggregations: Aggregations = useMemo(
        () => (hits.length === 0 ? {} : generateDynamicFilters(hits, activeFilters)),
        [hits, activeFilters]
    );

    const datasets = useMemo(() => applyLocalFilters(hits, activeFilters), [hits, activeFilters]);

    return {datasets, aggregations};
};
