import type {BackendDataset, Aggregations, AggregationBucket} from '../types/commons';

/**
 * Generate local filters (aggregations) from search results
 * Creates filters for publication date (by year), authors, and subjects
 */
export const generateLocalFilters = (datasets: BackendDataset[]): Aggregations => {
    const dateMap = new Map<string, number>();
    const authorMap = new Map<string, number>();
    const subjectMap = new Map<string, number>();

    // Process each dataset to build aggregations
    datasets.forEach(dataset => {
        // Extract publication date/year
        const publicationDate = dataset.publication_date || dataset._source.publicationYear;
        if (publicationDate) {
            // Extract year from date
            const year = extractYear(publicationDate);
            if (year) {
                dateMap.set(year, (dateMap.get(year) || 0) + 1);
            }
        }

        // Extract authors/creators
        const creators = dataset._source.creators || [];
        creators.forEach(creator => {
            const name = creator.creatorName?.trim();
            if (name) {
                authorMap.set(name, (authorMap.get(name) || 0) + 1);
            }
        });

        // Extract subjects
        const subjects = dataset._source.subjects || [];
        subjects.forEach(subj => {
            const subject = subj.subject?.trim();
            if (subject) {
                subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
            }
        });
    });

    // Convert maps to sorted bucket arrays
    const dateBuckets = mapToBuckets(dateMap, true); // Sort dates descending (newest first)
    const authorBuckets = mapToBuckets(authorMap, false, 20); // Limit to top 20 authors
    const subjectBuckets = mapToBuckets(subjectMap, false, 15); // Limit to top 15 subjects

    return {
        publicationYear: {
            label: 'Publication Year',
            buckets: dateBuckets
        },
        creator: {
            label: 'Author',
            buckets: authorBuckets
        },
        subject: {
            label: 'Subject',
            buckets: subjectBuckets
        }
    };
};

/**
 * Extract year from a date string (YYYY-MM-DD) or year string (YYYY)
 */
const extractYear = (dateStr: string): string | null => {
    if (!dateStr) return null;

    // If it's already just a year (4 digits)
    if (/^\d{4}$/.test(dateStr)) {
        return dateStr;
    }

    // Try to extract year from date string
    const yearMatch = dateStr.match(/^(\d{4})/);
    return yearMatch ? yearMatch[1] : null;
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

    // Apply limit if specified
    if (limit && buckets.length > limit) {
        return buckets.slice(0, limit);
    }

    return buckets;
};

/**
 * Apply local filters to datasets
 * Returns filtered array based on selected filter values
 */
export const applyLocalFilters = (
    datasets: BackendDataset[],
    filters: URLSearchParams
): BackendDataset[] => {
    const selectedYears = filters.getAll('publicationYear');
    const selectedAuthors = filters.getAll('creator');
    const selectedSubjects = filters.getAll('subject');

    // If no filters selected, return all datasets
    if (selectedYears.length === 0 && selectedAuthors.length === 0 && selectedSubjects.length === 0) {
        return datasets;
    }

    return datasets.filter(dataset => {
        // Check year filter
        if (selectedYears.length > 0) {
            const publicationDate = dataset.publication_date || dataset._source.publicationYear;
            const year = publicationDate ? extractYear(publicationDate) : null;
            if (!year || !selectedYears.includes(year)) {
                return false;
            }
        }

        // Check author filter
        if (selectedAuthors.length > 0) {
            const creators = dataset._source.creators || [];
            const hasMatchingAuthor = creators.some(creator =>
                selectedAuthors.includes(creator.creatorName?.trim())
            );
            if (!hasMatchingAuthor) {
                return false;
            }
        }

        // Check subject filter
        if (selectedSubjects.length > 0) {
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

