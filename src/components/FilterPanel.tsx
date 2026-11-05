import {FilterSection} from "./FilterSection.tsx";
import type {Aggregations} from "../types/commons";
import type {FilterKey} from "../lib/analytics.ts";
import useMatomo from "../hooks/useMatomo";


interface FilterPanelProps {
    aggregations: Aggregations;
    onFilterChange: (params: URLSearchParams) => void;
    activeFilters: URLSearchParams;
}

export const FilterPanel = ({aggregations, onFilterChange, activeFilters}: FilterPanelProps) => {
    const {trackEvent} = useMatomo();

    if (!aggregations) return null;

    const handleFilter = (key: string, value: string) => {
        const currentValues = activeFilters.getAll(key);
        const isRemoving = currentValues.includes(value);
        const newParams = new URLSearchParams(activeFilters);

        if (isRemoving) {
            newParams.delete(key);
            currentValues.filter(v => v !== value).forEach(v => newParams.append(key, v));
        } else {
            newParams.append(key, value);
        }

        // Only the facet and how many values are active afterwards: the value itself
        // is an author name or a subject, which must not end up in a report. The
        // facet keys are the backend's, from the closed set `FilterKey` names.
        const activeCountAfter = Array.from(newParams.keys()).length;
        trackEvent('Search', isRemoving ? 'filter_removed' : 'filter_applied', key as FilterKey, activeCountAfter);

        onFilterChange(newParams);
    };

    const getActiveFiltersFor = (key: string) => activeFilters.getAll(key);

    return (
        <aside className="w-full lg:w-1/4 lg:pr-8">
            <h2 className="text-xl font-bold mb-4">Filters</h2>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                {Object.entries(aggregations).map(([key, value]) => (
                    <FilterSection
                        key={key}
                        title={value.label}
                        buckets={value.buckets}
                        filterKey={key}
                        onFilterChange={(filterKey: string, bucketKey: string) => handleFilter(filterKey, bucketKey)}
                        activeFilters={getActiveFiltersFor(key)}
                        defaultOpen={key === 'publicationYear'}
                    />
                ))}
            </div>
        </aside>
    );
};
