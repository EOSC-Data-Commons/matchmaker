// Backend API types - matching Python SearchHit structure

export interface SearchHitSrcNameIdentifier {
    nameIdentifier: string;
    nameIdentifierScheme?: string | null;
}

export interface SearchHitSrcCreator {
    creatorName: string;
    // DataCite: "Personal" | "Organizational". The organizational creator (with a URL
    // nameIdentifier) identifies the owning repository/source — used for the provenance owner logo.
    nameType?: string | null;
    nameIdentifiers?: SearchHitSrcNameIdentifier[] | null;
}

export interface SearchHitSrcSubject {
    subject: string;
    lang?: string | null;
    subject_scheme?: string | null;
    schemaUri?: string | null;
    valueUri?: string | null;
    classificationCode?: string | null;
}

export interface SearchHitSrcTitle {
    title: string;
}

export interface SearchHitSrcDescription {
    description: string;
    lang?: string | null;
    descriptionType?: string | null;
}

export interface SearchHitSrcDate {
    date: string;
    dateType: string;
}

export interface SearchHitSrc {
    doi?: string | null;
    url?: string | null;
    _harvest_url?: string;
    _repo?: string;
    titles: SearchHitSrcTitle[];
    descriptions: SearchHitSrcDescription[];
    publicationYear: string;
    dates?: SearchHitSrcDate[] | null;
    subjects?: SearchHitSrcSubject[] | null;
    creators?: SearchHitSrcCreator[] | null;
    resourceType?: string;
}

export interface BackendDataset {
    _id: string;
    _source: SearchHitSrc;
    _score: number; //OpenSearch Score
    score?: number | null; //LLM Ranked Score
    fileExtensions?: string[] | null;
    relevantTools?: string[] | null;
    // Canonical URL of the dataset (DOI when available). The assistant cites datasets
    // as plain Markdown links to this URL, and the chat resolves a link back to its
    // result card by matching the href against this value.
    dataset_url?: string | null;
    title?: string | null;
    description?: string | null;
    publication_date?: string | null;
    creator?: string | null;
}

/**
 * Payload of a search tool result (the backend's `SearchResults`). The assistant's
 * summary is no longer part of it — it is streamed as regular message text.
 */
export interface SearchResults {
    hits: BackendDataset[];
    total_found?: number;
}

export interface AggregationBucket {
    key: string;
    label: string;
    doc_count: number;
}

export interface AggregationSection {
    label: string;
    buckets: AggregationBucket[];
}

export interface Aggregations {
    [key: string]: AggregationSection;
}

// Repository statistics (GET /api/search/stats)
export interface RepositoryStatsSubject {
    subject: string;
    count: number;
}

export interface RepositoryStat {
    code: string;
    name: string;
    record_count: number;
    datasets: number;
    endpoints_with_records: number;
    synced_to_opensearch: number;
    latest_record_datestamp: string | null;
    top_subjects: RepositoryStatsSubject[];
}

export interface RepositoryStatsResponse {
    api_version: string;
    generated_at: string;
    total_records: number;
    total_datasets: number;
    repositories: RepositoryStat[];
}
