import type {BackendDataset, Aggregations, AggregationBucket} from '../types/commons';

/**
 * Extract year from a date string (YYYY-MM-DD) or year string (YYYY)
 */
const extractYear = (dateStr: string | null | undefined): string | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;

    // Trim whitespace
    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    // If it's already just a year (4 digits)
    if (/^\d{4}$/.test(trimmed)) {
        const year = parseInt(trimmed, 10);
        // Validate year is reasonable (between 1900 and 2100)
        if (year >= 1900 && year <= 2100) {
            return trimmed;
        }
        return null;
    }

    // Try to extract year from date string (ISO format YYYY-MM-DD or similar)
    const yearMatch = trimmed.match(/^(\d{4})/);
    if (yearMatch) {
        const year = parseInt(yearMatch[1], 10);
        // Validate year is reasonable
        if (year >= 1900 && year <= 2100) {
            return yearMatch[1];
        }
    }

    return null;
};

/**
 * Convert a Map to sorted AggregationBucket array
 */
const mapToBuckets = (
    map: Map<string, number>,
    sortByKeyDesc: boolean = false,
    limit?: number
): AggregationBucket[] => {
    const buckets: AggregationBucket[] = Array.from(map.entries()).map(([key, count]) => ({
        key,
        label: key,
        doc_count: count
    }));

    // Sort by count descending, or by key if specified
    if (sortByKeyDesc) {
        buckets.sort((a, b) => b.key.localeCompare(a.key)); // Descending by key (for years)
    } else {
        buckets.sort((a, b) => b.doc_count - a.doc_count); // Descending by count
    }

    if (limit && buckets.length > limit) {
        return buckets.slice(0, limit);
    }

    return buckets;
};

/**
 * Apply local filters to datasets
 * Returns filtered array based on selected filter values
 * @param datasets - Array of datasets to filter
 * @param filters - URL search params containing filter selections
 * @param excludeKey - Optional filter key to exclude from filtering (used for dynamic filter recalculation)
 */
export const applyLocalFilters = (
    datasets: BackendDataset[],
    filters: URLSearchParams,
    excludeKey?: string
): BackendDataset[] => {
    const selectedYears = filters.getAll('publicationYear');
    const selectedAuthors = filters.getAll('creator');
    const selectedSubjects = filters.getAll('subject');

    // If no filters selected, return all datasets
    if (selectedYears.length === 0 && selectedAuthors.length === 0 && selectedSubjects.length === 0) {
        return datasets;
    }

    return datasets.filter(dataset => {
        // Apply year filter unless it's excluded
        if (excludeKey !== 'publicationYear' && selectedYears.length > 0) {
            let publicationDate = dataset.publication_date;
            if (!publicationDate && dataset._source?.publicationYear) {
                publicationDate = dataset._source.publicationYear;
            }
            const year = publicationDate ? extractYear(publicationDate) : null;

            if (!year || !selectedYears.includes(year)) {
                return false;
            }
        }

        // Apply author filter unless it's excluded
        if (excludeKey !== 'creator' && selectedAuthors.length > 0) {
            const creators = dataset._source.creators || [];
            const hasMatchingAuthor = creators.some(creator =>
                selectedAuthors.includes(creator.creatorName?.trim())
            );
            if (!hasMatchingAuthor) {
                return false;
            }
        }

        // Apply subject filter unless it's excluded
        if (excludeKey !== 'subject' && selectedSubjects.length > 0) {
            const subjects = dataset._source.subjects || [];
            const hasMatchingSubject = subjects.some(subj =>
                selectedSubjects.includes(subj.subject?.trim())
            );
            if (!hasMatchingSubject) {
                return false;
            }
        }

        return true;
    });
};
/**
 * Generate dynamic local filters based on dataset collection
 * Each filter's options are calculated based on datasets that match OTHER filters
 * Optimized to perform a single pass through the dataset
 * @param datasets - Complete collection of datasets to analyze
 * @param activeFilters - Currently active filter selections from URL params
 * @returns Aggregations with dynamically calculated filter options and counts
 */
export const generateDynamicFilters = (
    datasets: BackendDataset[],
    activeFilters: URLSearchParams
): Aggregations => {
    const selectedYears = activeFilters.getAll('publicationYear');
    const selectedAuthors = activeFilters.getAll('creator');
    const selectedSubjects = activeFilters.getAll('subject');

    // Maps to accumulate counts for each filter type
    const yearMap = new Map<string, number>();
    const authorMap = new Map<string, number>();
    const subjectMap = new Map<string, number>();

    datasets.forEach(dataset => {
        let publicationDate = dataset.publication_date;
        if (!publicationDate && dataset._source?.publicationYear) {
            publicationDate = dataset._source.publicationYear;
        }
        const year = publicationDate ? extractYear(publicationDate) : null;

        const creators = dataset._source.creators || [];
        const subjects = dataset._source.subjects || [];

        // Check if dataset matches filters (for each aggregation type)
        const matchesAuthorFilter = selectedAuthors.length === 0 ||
            creators.some(creator => selectedAuthors.includes(creator.creatorName?.trim()));

        const matchesSubjectFilter = selectedSubjects.length === 0 ||
            subjects.some(subj => selectedSubjects.includes(subj.subject?.trim()));

        const matchesYearFilter = selectedYears.length === 0 ||
            (year && selectedYears.includes(year));

        if (matchesAuthorFilter && matchesSubjectFilter && year) {
            yearMap.set(year, (yearMap.get(year) || 0) + 1);
        }

        if (matchesYearFilter && matchesSubjectFilter) {
            creators.forEach(creator => {
                const name = creator.creatorName?.trim();
                if (name) {
                    authorMap.set(name, (authorMap.get(name) || 0) + 1);
                }
            });
        }

        if (matchesYearFilter && matchesAuthorFilter) {
            subjects.forEach(subj => {
                const subject = subj.subject?.trim();
                if (subject) {
                    subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
                }
            });
        }
    });

    // Convert maps to aggregation buckets
    const aggregations: Aggregations = {};

    const yearBuckets = mapToBuckets(yearMap, true);
    if (yearBuckets.length > 0) {
        aggregations.publicationYear = {
            label: 'Publication Year',
            buckets: yearBuckets
        };
    }

    const authorBuckets = mapToBuckets(authorMap, false, 20);
    if (authorBuckets.length > 0) {
        aggregations.creator = {
            label: 'Author',
            buckets: authorBuckets
        };
    }

    const subjectBuckets = mapToBuckets(subjectMap, false, 15);
    if (subjectBuckets.length > 0) {
        aggregations.subject = {
            label: 'Subject',
            buckets: subjectBuckets
        };
    }

    return aggregations;
};

