import {useMemo} from 'react';
import type {BackendSearchResponse, BackendDataset} from '../types/commons';
import {applyLocalFilters} from '../lib/localFilters';

interface UseFilteredDatasetsReturn {
    filteredDatasets: BackendDataset[];
    filteredRerankedDatasets: BackendDataset[] | null;
    filteredInitialDatasets: BackendDataset[] | null;
    datasets: BackendDataset[];
}

export const useFilteredDatasets = (
    allCombinedDatasets: BackendDataset[],
    initialResults: BackendSearchResponse | null,
    rerankedResults: BackendSearchResponse | null,
    activeFilters: URLSearchParams
): UseFilteredDatasetsReturn => {

    // Apply filters to ALL combined datasets
    const filteredDatasets = useMemo(() => {
        return applyLocalFilters(allCombinedDatasets, activeFilters);
    }, [allCombinedDatasets, activeFilters]);

    const filteredRerankedDatasets = useMemo(() => {
        if (!rerankedResults) return null;
        const filteredIds = new Set(filteredDatasets.map(d => d._id));
        return rerankedResults.hits.filter(d => filteredIds.has(d._id));
    }, [rerankedResults, filteredDatasets]);

    const filteredInitialDatasets = useMemo(() => {
        if (!initialResults) return null;
        const filteredIds = new Set(filteredDatasets.map(d => d._id));
        return initialResults.hits.filter(d => filteredIds.has(d._id));
    }, [initialResults, filteredDatasets]);

    // If reranked results exist, prefer showing them, but if filtering removes all reranked results,
    // fall back to showing filtered initial results
    const datasets = useMemo(() => {
        if (filteredRerankedDatasets !== null && filteredRerankedDatasets.length > 0) {
            return filteredRerankedDatasets;
        }
        if (filteredInitialDatasets !== null && filteredInitialDatasets.length > 0) {
            return filteredInitialDatasets;
        }
        if (rerankedResults && filteredInitialDatasets && filteredInitialDatasets.length > 0) {
            return filteredInitialDatasets;
        }
        return [];
    }, [filteredRerankedDatasets, filteredInitialDatasets, rerankedResults]);

    return {
        filteredDatasets,
        filteredRerankedDatasets,
        filteredInitialDatasets,
        datasets,
    };
};

