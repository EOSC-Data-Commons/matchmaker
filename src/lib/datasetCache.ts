interface DatasetMetadata {
    title: string;
    description: string;
    updatedAt: number;
}

const CACHE_PREFIX = 'dataplayer:';

export function cacheDatasetMetadata(
    datasetId: string,
    title: string,
    description: string,
): void {
    try {
        localStorage.setItem(
            `${CACHE_PREFIX}${datasetId}`,
            JSON.stringify({
                title,
                description,
                updatedAt: Date.now(),
            })
        );
    } catch (error) {
        console.warn('Failed to cache dataset metadata', error);
    }
}

export function getCachedDatasetMetadata(
    datasetId: string | null,
): DatasetMetadata | null {
    if (!datasetId) return null;

    try {
        const cached = localStorage.getItem(
            `${CACHE_PREFIX}${datasetId}`
        );

        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        console.warn('Failed to read cached dataset metadata', error);
        return null;
    }
}
