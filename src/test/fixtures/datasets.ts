import type {BackendDataset, SearchHitSrc} from "@/types/commons";

type DatasetOverrides = Omit<Partial<BackendDataset>, "_source"> & {
    _source?: Partial<SearchHitSrc>;
};

/**
 * Build a BackendDataset fixture. Defaults describe a typical, fully-populated
 * hit; override individual fields per test.
 */
export const makeDataset = (overrides: DatasetOverrides = {}): BackendDataset => {
    const {_source: sourceOverrides, ...rest} = overrides;
    return {
        _id: "https://doi.org/10.5281/zenodo.1234567",
        _score: 1.0,
        title: "Test Dataset Title",
        description: "A dataset used in tests.",
        publication_date: "2023-05-17",
        creator: "Doe, Jane",
        _source: {
            titles: [{title: "Test Dataset Title"}],
            descriptions: [{description: "A dataset used in tests."}],
            publicationYear: "2023",
            creators: [{creatorName: "Doe, Jane"}, {creatorName: "Smith, John"}],
            subjects: [{subject: "climate"}, {subject: "oceanography"}],
            ...sourceOverrides,
        },
        ...rest,
    };
};
