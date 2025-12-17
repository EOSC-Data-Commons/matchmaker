import {useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import type {BackendSearchResponse, BackendDataset} from '../types/commons';
import {applyLocalFilters} from '../lib/localFilters';

interface UseFilteredDatasetsReturn {
    activeFilters: URLSearchParams;
    filteredDatasets: BackendDataset[];
    filteredRerankedDatasets: BackendDataset[] | null;
    filteredInitialDatasets: BackendDataset[] | null;
    datasets: BackendDataset[];
}

export const useFilteredDatasets = (
    allCombinedDatasets: BackendDataset[],
    initialResults: BackendSearchResponse | null,
    rerankedResults: BackendSearchResponse | null
): UseFilteredDatasetsReturn => {
    const [searchParams] = useSearchParams();

    // Get active filter params (excluding 'q' and 'model')
    const activeFilters = useMemo(() => {
        const filters = new URLSearchParams();
        searchParams.forEach((value, key) => {
            if (key !== 'q' && key !== 'model') {
                filters.append(key, value);
            }
        });
        return filters;
    }, [searchParams]);

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
        activeFilters,
        filteredDatasets,
        filteredRerankedDatasets,
        filteredInitialDatasets,
        datasets,
    };
};

