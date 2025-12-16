import {useMemo} from 'react';
import type {BackendSearchResponse, BackendDataset, Aggregations} from '../types/commons';
import {generateLocalFilters} from '../lib/localFilters';

interface UseCombinedDatasetsReturn {
    allCombinedDatasets: BackendDataset[];
    aggregations: Aggregations;
}

export const useCombinedDatasets = (
    initialResults: BackendSearchResponse | null,
    rerankedResults: BackendSearchResponse | null
): UseCombinedDatasetsReturn => {
    // Combine all datasets from both result sets (deduplicated, preserving order)
    const allCombinedDatasets = useMemo(() => {
        const datasetsMap = new Map<string, BackendDataset>();

        // Strategy: Prefer reranked results order, supplement with initial results
        // This ensures we maintain the best available ranking

        if (rerankedResults?.hits) {
            // Add reranked results first (they have the best ranking)
            rerankedResults.hits.forEach(dataset => {
                datasetsMap.set(dataset._id, dataset);
            });
        }

        if (initialResults?.hits) {
            // Add initial results that aren't in reranked (preserves their order for non-reranked items)
            initialResults.hits.forEach(dataset => {
                if (!datasetsMap.has(dataset._id)) {
                    datasetsMap.set(dataset._id, dataset);
                }
            });
        }

        // Return as array, maintaining insertion order (Map preserves insertion order)
        return Array.from(datasetsMap.values());
    }, [rerankedResults, initialResults]);

    // Generate local filters from ALL combined results
    const aggregations: Aggregations = useMemo(() => {
        if (allCombinedDatasets.length === 0) {
            return {};
        }

        return generateLocalFilters(allCombinedDatasets);
    }, [allCombinedDatasets]);

    return {
        allCombinedDatasets,
        aggregations,
    };
};

