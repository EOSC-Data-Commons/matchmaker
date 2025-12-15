import {ChevronDownIcon} from "lucide-react";
import {useState} from "react";
import type {AggregationBucket} from "../types/commons";

interface FilterSectionProps {
    title: string;
    buckets: AggregationBucket[];
    filterKey: string;
    onFilterChange: (filterKey: string, bucketKey: string) => void;
    activeFilters: string[];
    defaultOpen?: boolean;
}

export const FilterSection = ({
                                  title,
                                  buckets,
                                  filterKey,
                                  onFilterChange,
                                  activeFilters,
                                  defaultOpen = false
                              }: FilterSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="py-4 border-b border-gray-200">
            <button onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex justify-between items-center font-semibold text-gray-800">
                {title}
                <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </button>
            {isOpen && (
                <div className="mt-3 space-y-2">
                    {buckets.map(bucket => (
                        <div key={bucket.key} className="flex items-center">
                            <input
                                type="checkbox"
                                id={`${filterKey}-${bucket.key}`}
                                checked={activeFilters.includes(bucket.key)}
                                onChange={() => onFilterChange(filterKey, bucket.key)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor={`${filterKey}-${bucket.key}`}
                                   className="ml-3 text-sm text-gray-600 flex-grow">
                                {bucket.label} ({bucket.doc_count.toLocaleString()})
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
