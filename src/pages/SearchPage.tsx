import {useNavigate, useSearchParams} from "react-router-dom";
import {useEffect, useState} from "react";
import {XCircleIcon, ChevronDown, ChevronUp, Sparkles} from "lucide-react";
import {SearchInput} from "../components/SearchInput.tsx";
import {SearchResultItem} from "../components/SearchResultItem.tsx";
import {AlphaDisclaimer} from "../components/AlphaDisclaimer";
import {Footer} from "../components/Footer";
import {FilterPanel} from "../components/FilterPanel.tsx";
import {ProcessingIndicator} from "../components/ProcessingIndicator.tsx";
import {NoResultsMessage} from "../components/NoResultsMessage.tsx";
import {LoadingOverlay} from "../components/LoadingOverlay.tsx";
import {useSearchResults} from "../hooks/useSearchResults.ts";
import {useCombinedDatasets} from "../hooks/useCombinedDatasets.ts";
import {useFilteredDatasets} from "../hooks/useFilteredDatasets.ts";
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';

export const SearchPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showInitialResults, setShowInitialResults] = useState(false);

    const query = searchParams.get('q') || '';
    const model = searchParams.get('model') || 'einfracz/gpt-oss-120b';

    // Custom hooks for data management
    const {
        initialResults,
        rerankedResults,
        loading,
        isProcessing,
        error,
        performSearch
    } = useSearchResults(query, model);

    const {allCombinedDatasets, aggregations} = useCombinedDatasets(initialResults, rerankedResults);

    const {
        activeFilters,
        filteredRerankedDatasets,
        filteredInitialDatasets,
        datasets
    } = useFilteredDatasets(allCombinedDatasets, initialResults, rerankedResults);

    // Trigger search when query or model changes
    useEffect(() => {
        void (async () => {
            try {
                setShowInitialResults(false); // Reset collapsible state on new search
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

    const hasRerankedResults = rerankedResults !== null;
    const hasInitialResults = initialResults !== null;

    return (
        <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
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
                    {/* Filter Panel - Only show when AI results are ready */}
                    {!loading && !error && hasRerankedResults && Object.keys(aggregations).length > 0 && (
                        <FilterPanel
                            aggregations={aggregations}
                            onFilterChange={handleFilterChange}
                            activeFilters={activeFilters}
                        />
                    )}

                    <div className="flex-1 relative" aria-busy={loading} aria-live="polite">
                        {/* Loading overlay */}
                        <LoadingOverlay show={loading}/>

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
                        <ProcessingIndicator show={!loading && !error && hasInitialResults && isProcessing}/>

                        {/* Results section */}
                        <div
                            className={loading ? 'opacity-0 pointer-events-none select-none' : 'opacity-100 transition-opacity'}
                            aria-hidden={loading}>
                            {!loading && !error && (
                                datasets.length === 0 ? (
                                    <NoResultsMessage/>
                                ) : (
                                    <>
                                        {/* AI-Ranked Results Section (when AI results match filters) */}
                                        {hasRerankedResults && filteredRerankedDatasets && filteredRerankedDatasets.length > 0 && (
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

                                        {/* Fallback to Initial Results (when AI results don't match filters) */}
                                        {hasRerankedResults && filteredRerankedDatasets && filteredRerankedDatasets.length === 0 &&
                                            filteredInitialDatasets && filteredInitialDatasets.length > 0 && (
                                                <div className="mb-8">
                                                    <div
                                                        className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                        <p className="text-sm text-amber-800">
                                                            <span className="font-medium">Note:</span> No AI-ranked
                                                            results match your filters.
                                                            Showing {filteredInitialDatasets.length} result{filteredInitialDatasets.length !== 1 ? 's' : ''} from
                                                            initial search.
                                                        </p>
                                                    </div>

                                                    <div className="space-y-4">
                                                        {datasets.map((dataset, index) => (
                                                            <SearchResultItem
                                                                key={`initial-fallback-${dataset._id}-${index}`}
                                                                hit={dataset}
                                                                isAiRanked={false}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                        {/* Initial Results (when no reranked results exist yet) */}
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

                                        {/* Collapsible Initial Results Section (only when showing AI-ranked results) */}
                                        {hasRerankedResults && filteredRerankedDatasets && filteredRerankedDatasets.length > 0 &&
                                            hasInitialResults && filteredInitialDatasets && filteredInitialDatasets.length > 0 && (
                                                <div className="mb-8">
                                                    <button
                                                        onClick={() => setShowInitialResults(!showInitialResults)}
                                                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                        <span className="text-gray-700 font-medium">
                                                            Initial Search Results ({filteredInitialDatasets.length} dataset{filteredInitialDatasets.length !== 1 ? 's' : ''})
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
                                                            {filteredInitialDatasets.map((dataset, index) => (
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
