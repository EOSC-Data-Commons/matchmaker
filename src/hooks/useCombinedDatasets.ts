import {useMemo} from 'react';
import type {BackendSearchResponse, BackendDataset, Aggregations} from '../types/commons';
import {generateDynamicFilters} from '../lib/localFilters';

interface UseCombinedDatasetsReturn {
    allCombinedDatasets: BackendDataset[];
    aggregations: Aggregations;
}

export const useCombinedDatasets = (
    initialResults: BackendSearchResponse | null,
    rerankedResults: BackendSearchResponse | null,
    activeFilters: URLSearchParams
): UseCombinedDatasetsReturn => {
    // Combine all datasets from both result sets
    const allCombinedDatasets = useMemo(() => {
        const datasetsMap = new Map<string, BackendDataset>();

        if (rerankedResults?.hits) {
            // Add reranked results first (they have the best ranking)
            rerankedResults.hits.forEach(dataset => {
                datasetsMap.set(dataset._id, dataset);
            });
        }

        if (initialResults?.hits) {
            // Add initial results that aren't in reranked
            initialResults.hits.forEach(dataset => {
                if (!datasetsMap.has(dataset._id)) {
                    datasetsMap.set(dataset._id, dataset);
                }
            });
        }

        return Array.from(datasetsMap.values());
    }, [rerankedResults, initialResults]);

    // Generate dynamic filters that recalculate based on active filters
    const aggregations: Aggregations = useMemo(() => {
        if (allCombinedDatasets.length === 0) {
            return {};
        }

        return generateDynamicFilters(allCombinedDatasets, activeFilters);
    }, [allCombinedDatasets, activeFilters]);

    return {
        allCombinedDatasets,
        aggregations,
    };
};

