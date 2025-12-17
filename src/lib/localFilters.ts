import type {BackendDataset, Aggregations, AggregationBucket} from '../types/commons';

/**
 * Generate local filters (aggregations) from search results
 * Creates filters for publication date (by year), authors, and subjects
 */
export const generateLocalFilters = (datasets: BackendDataset[]): Aggregations => {
    const dateMap = new Map<string, number>();
    const authorMap = new Map<string, number>();
    const subjectMap = new Map<string, number>();

    datasets.forEach((dataset) => {
        // Extract publication date/year
        let publicationDate = dataset.publication_date;
        if (!publicationDate && dataset._source?.publicationYear) {
            publicationDate = dataset._source.publicationYear;
        }

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

    const dateBuckets = mapToBuckets(dateMap, true); // Sort dates descending (newest first)
    const authorBuckets = mapToBuckets(authorMap, false, 20); // Limit to top 20 authors
    const subjectBuckets = mapToBuckets(subjectMap, false, 15); // Limit to top 15 subjects


    const aggregations: Aggregations = {};
    if (dateBuckets.length > 0) {
        aggregations.publicationYear = {
            label: 'Publication Year',
            buckets: dateBuckets
        };
    }
    if (authorBuckets.length > 0) {
        aggregations.creator = {
            label: 'Author',
            buckets: authorBuckets
        };
    }
    if (subjectBuckets.length > 0) {
        aggregations.subject = {
            label: 'Subject',
            buckets: subjectBuckets
        };
    }
    return aggregations;
};

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

        if (selectedYears.length > 0) {
            let publicationDate = dataset.publication_date;
            if (!publicationDate && dataset._source?.publicationYear) {
                publicationDate = dataset._source.publicationYear;
            }
            const year = publicationDate ? extractYear(publicationDate) : null;

            if (!year || !selectedYears.includes(year)) {
                return false;
            }
        }


        if (selectedAuthors.length > 0) {
            const creators = dataset._source.creators || [];
            const hasMatchingAuthor = creators.some(creator =>
                selectedAuthors.includes(creator.creatorName?.trim())
            );
            if (!hasMatchingAuthor) {
                return false;
            }
        }


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
