import {FilterSection} from "./FilterSection.tsx";
import type {Aggregations} from "../types/commons";


interface FilterPanelProps {
    aggregations: Aggregations;
    onFilterChange: (params: URLSearchParams) => void;
    activeFilters: URLSearchParams;
}

export const FilterPanel = ({aggregations, onFilterChange, activeFilters}: FilterPanelProps) => {
    if (!aggregations) return null;

    const handleFilter = (key: string, value: string) => {
        const currentValues = activeFilters.getAll(key);
        const newParams = new URLSearchParams(activeFilters);

        if (currentValues.includes(value)) {
            // Unchecking - remove this value
            newParams.delete(key);
            currentValues.filter(v => v !== value).forEach(v => newParams.append(key, v));
        } else {
            // Checking - add this value
            newParams.append(key, value);
        }

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
