import {useNavigate, useSearchParams} from "react-router-dom";
import type {BackendSearchResponse, Aggregations} from "../types/commons.ts";
import {useCallback, useEffect, useState, useMemo} from "react";
import {searchWithBackend} from "../lib/api.ts";
import {addToSearchHistory} from "../lib/history.ts";
import {BookIcon, LoaderIcon, XCircleIcon, ChevronDown, ChevronUp, Sparkles} from "lucide-react";
import {SearchInput} from "../components/SearchInput.tsx";
import {SearchResultItem} from "../components/SearchResultItem.tsx";
import {AlphaDisclaimer} from "../components/AlphaDisclaimer";
import {Footer} from "../components/Footer";
import {FilterPanel} from "../components/FilterPanel.tsx";
import {generateLocalFilters, applyLocalFilters} from "../lib/localFilters.ts";
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';

export const SearchPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [initialResults, setInitialResults] = useState<BackendSearchResponse | null>(null);
    const [rerankedResults, setRerankedResults] = useState<BackendSearchResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showInitialResults, setShowInitialResults] = useState(false);

    const query = searchParams.get('q') || '';
    const model = searchParams.get('model') || 'einfracz/gpt-oss-120b';

    // Generate local filters from the displayed results
    const aggregations: Aggregations = useMemo(() => {
        const resultsToUse = rerankedResults || initialResults;
        if (!resultsToUse || resultsToUse.hits.length === 0) {
            return {};
        }
        return generateLocalFilters(resultsToUse.hits);
    }, [rerankedResults, initialResults]);

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

    // Apply filters to the displayed results
    const filteredDatasets = useMemo(() => {
        const resultsToUse = rerankedResults || initialResults;
        if (!resultsToUse) return [];
        return applyLocalFilters(resultsToUse.hits, activeFilters);
    }, [rerankedResults, initialResults, activeFilters]);

    const performSearch = useCallback(async () => {
        if (!query) {
            navigate('/');
            return;
        }

        setLoading(true);
        setIsProcessing(false);
        setError(null);
        setInitialResults(null);
        setRerankedResults(null);
        setShowInitialResults(false);

        try {
            await searchWithBackend(query, model, {
                onSearchData: (data) => {
                    setInitialResults(data);
                    console.log("Initial search data received:", data);
                    setLoading(false);
                    setIsProcessing(data.hits && data.hits.length > 0);
                },
                onRerankedData: (data) => {
                    setRerankedResults(data);
                    setIsProcessing(false);
                },
                onError: (err) => {
                    console.error("Search stream error:", err);
                    setError(err.message);
                    setLoading(false);
                    setIsProcessing(false);
                },
                // onEvent: (event) => {
                //     console.debug('SSE Event:', event);
                // },
            });
            addToSearchHistory(query);
        } catch (err) {
            console.error("Search error:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
            setLoading(false);
            setIsProcessing(false);
        }
    }, [query, model, navigate]);

    useEffect(() => {
        void (async () => {
            try {
                await performSearch();
            } catch (err) {
                console.error("Unhandled search error:", err);
            }
        })();
    }, [performSearch]);

    const handleSearch = (newQuery: string, newModel: string) => {
        setSearchParams({q: newQuery, model: newModel});
    };

    const handleFilterChange = (newFilters: URLSearchParams) => {
        const params = new URLSearchParams(newFilters);
        params.set('q', query);
        params.set('model', model);
        setSearchParams(params);
    };

    const datasets = filteredDatasets;
    const hasRerankedResults = rerankedResults !== null;
    const hasInitialResults = initialResults !== null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <AlphaDisclaimer/>
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-3">
                    <img
                        src={dataCommonsIconBlue}
                        alt="EOSC Logo"
                        className="h-9 w-auto cursor-pointer"
                        onClick={() => navigate('/')}
                    />
                    <div className="flex-grow ml-4">
                        <SearchInput onSearch={handleSearch} initialQuery={query} initialModel={model}/>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Summary - show reranked summary if available */}
                {!loading && !error && hasRerankedResults && rerankedResults.summary && (
                    <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-blue-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Generated Summary</h3>
                        <p className="text-gray-700">{rerankedResults.summary}</p>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Filter Panel */}
                    {!loading && !error && Object.keys(aggregations).length > 0 && (
                        <FilterPanel
                            aggregations={aggregations}
                            onFilterChange={handleFilterChange}
                            activeFilters={activeFilters}
                        />
                    )}

                    <div className="flex-1 relative" aria-busy={loading} aria-live="polite">
                        {/* Loading overlay */}
                        {loading && (
                            <div
                                className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-10 rounded-lg">
                                <div className="flex items-center space-x-2 text-gray-700">
                                    <LoaderIcon className="h-6 w-6 animate-spin text-blue-600"/>
                                    <span className="text-sm sm:text-base">Searching datasets...</span>
                                </div>
                            </div>
                        )}

                        {/* Error state inline */}
                        {!loading && error && (
                            <div
                                className="p-6 bg-white rounded-lg shadow-sm border border-red-200 text-center space-y-4">
                                <XCircleIcon className="h-12 w-12 text-red-500 mx-auto"/>
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Search Error</h2>
                                    <p className="text-gray-600 mb-4">{error}</p>
                                    <button
                                        onClick={performSearch}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Processing indicator - shows when initial results exist but reranking is in progress */}
                        {!loading && !error && hasInitialResults && isProcessing && (
                            <div
                                className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-300 animate-pulse">
                                <div className="flex items-center space-x-3 text-blue-700">
                                    <Sparkles className="h-5 w-5 animate-pulse"/>
                                    <span
                                        className="text-sm font-medium">AI is analyzing and reranking results...</span>
                                    <LoaderIcon className="h-4 w-4 animate-spin"/>
                                </div>
                            </div>
                        )}

                        {/* Results section */}
                        <div
                            className={loading ? 'opacity-0 pointer-events-none select-none' : 'opacity-100 transition-opacity'}
                            aria-hidden={loading}>
                            {!loading && !error && (
                                datasets.length === 0 ? (
                                    <div
                                        className="text-center py-12 bg-white/60 rounded-lg border border-dashed border-gray-300">
                                        <BookIcon className="h-12 w-12 text-gray-400 mx-auto mb-4"/>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No datasets found</h3>
                                        <p className="text-gray-600">Try adjusting your search terms or filters.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Reranked Results Section */}
                                        {hasRerankedResults && (
                                            <div className="mb-8">
                                                <div className="mb-4 flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <Sparkles className="h-5 w-5 text-blue-600"/>
                                                        <p className="text-gray-700 font-medium">
                                                            AI-Ranked Results
                                                            ({datasets.length} dataset{datasets.length !== 1 ? 's' : ''})
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    {datasets.map((dataset, index) => (
                                                        <SearchResultItem
                                                            key={`reranked-${dataset._id}-${index}`}
                                                            hit={dataset}
                                                            isAiRanked={true}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Initial Results (collapsed when reranked results exist) */}
                                        {!hasRerankedResults && hasInitialResults && (
                                            <div className="mb-8">
                                                <div className="mb-4">
                                                    <p className="text-gray-600">
                                                        Found {datasets.length} dataset{datasets.length !== 1 ? 's' : ''}
                                                    </p>
                                                </div>

                                                <div className="space-y-4">
                                                    {datasets.map((dataset, index) => (
                                                        <SearchResultItem
                                                            key={`initial-${dataset._id}-${index}`}
                                                            hit={dataset}
                                                            isAiRanked={false}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Collapsible Initial Results Section (when reranked results exist) */}
                                        {hasRerankedResults && hasInitialResults && (
                                            <div className="mb-8">
                                                <button
                                                    onClick={() => setShowInitialResults(!showInitialResults)}
                                                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-gray-700 font-medium">
                                                            Initial Search Results ({initialResults.hits.length} dataset{initialResults.hits.length !== 1 ? 's' : ''})
                                                        </span>
                                                    </div>
                                                    {showInitialResults ? (
                                                        <ChevronUp className="h-5 w-5 text-gray-600"/>
                                                    ) : (
                                                        <ChevronDown className="h-5 w-5 text-gray-600"/>
                                                    )}
                                                </button>

                                                {showInitialResults && (
                                                    <div
                                                        className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        {initialResults.hits.map((dataset, index) => (
                                                            <SearchResultItem
                                                                key={`initial-collapsed-${dataset._id}-${index}`}
                                                                hit={dataset}
                                                                isAiRanked={false}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </main>
            {/* Footer only when results list is present */}
            {!loading && (
                <Footer translucent/>
            )}
        </div>
    );
};
