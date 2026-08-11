import {useNavigate, useSearchParams} from "react-router";
import {useEffect, useMemo} from "react";
import {XCircleIcon, Clock, AlertTriangle} from "lucide-react";
import {SearchInput} from "../components/SearchInput.tsx";
import {SearchResultItem} from "../components/SearchResultItem.tsx";
import {AlphaDisclaimer} from "../components/AlphaDisclaimer";
import {Footer} from "../components/Footer";
import {FilterPanel} from "../components/FilterPanel.tsx";
import {NoResultsMessage} from "../components/NoResultsMessage.tsx";
import {LoadingOverlay} from "../components/LoadingOverlay.tsx";
import {useSearchResults} from "../hooks/useSearchResults.ts";
import {useDatasetFilters} from "../hooks/useDatasetFilters.ts";
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import {RateLimitError, ServerError} from "../lib/api.ts";
import {useAuth} from "@/hooks/useAuth.ts";
import {SearchFeedback} from "../components/SearchFeedback.tsx";

export const SearchPage = () => {
    const navigate = useNavigate();
    const {user} = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const query = searchParams.get('q') || '';
    const model = searchParams.get('model') || 'cesnet/agentic';

    // Custom hooks for data management
    const {results, loading, error, performSearch} = useSearchResults(query);

    // Extract active filters from URL params
    const activeFilters = useMemo(() => {
        const filters = new URLSearchParams();
        searchParams.forEach((value, key) => {
            if (key !== 'q' && key !== 'model') {
                filters.append(key, value);
            }
        });
        return filters;
    }, [searchParams]);

    const {datasets, aggregations} = useDatasetFilters(results, activeFilters);

    // Trigger search when query or model changes
    useEffect(() => {
        void (async () => {
            try {
                await performSearch();
            } catch (err) {
                console.error("Unhandled search error:", err);
            }
        })();
    }, [performSearch]);

    const handleSearch = (newQuery: string, newModel: string, aiMode?: boolean) => {
        if (aiMode) {
            navigate('/chat', {state: {initialQuery: newQuery, initialModel: newModel}});
        } else {
            setSearchParams({q: newQuery, model: newModel});
        }
    };

    const handleFilterChange = (newFilters: URLSearchParams) => {
        const params = new URLSearchParams(newFilters);
        params.set('q', query);
        params.set('model', model);
        setSearchParams(params);
    };

    const isRateLimit = error instanceof RateLimitError;
    const isServerError = error instanceof ServerError;
    const hasError = !!error;

    // Helper to determine error UI properties
    const getErrorState = () => {
        if (isRateLimit) {
            return {
                title: "Rate Limit Exceeded",
                color: "orange",
                icon: Clock
            };
        }
        if (isServerError) {
            return {
                title: "Service Unavailable",
                color: "red",
                icon: AlertTriangle
            };
        }
        return {
            title: "Search Error",
            color: "red",
            icon: XCircleIcon
        };
    };

    const errorState = getErrorState();
    const ErrorIcon = errorState.icon;

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
                        {/* AI mode starts off here: landing on the plain results page already
                            means the user chose plain search, so it must be opted back into. */}
                        <SearchInput
                            onSearch={handleSearch}
                            initialQuery={query}
                            initialModel={model}
                            isLoggedIn={!!user}
                            showAiToggle={true}
                            initialAiMode={false}
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Filter Panel - only once there are hits to build facets from */}
                    {!loading && !hasError && Object.keys(aggregations).length > 0 && (
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
                        {!loading && hasError && (
                            <div
                                className={`p-6 bg-white rounded-lg shadow-sm border border-${errorState.color}-200 text-center space-y-4`}>
                                <ErrorIcon className={`h-12 w-12 text-${errorState.color}-500 mx-auto`}/>
                                <div>
                                    <h2 className={`text-xl font-semibold text-${errorState.color}-800 mb-2`}>
                                        {errorState.title}
                                    </h2>
                                    <p className="text-gray-600 mb-4">{error.message}</p>
                                    <button
                                        onClick={performSearch}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Results section */}
                        <div
                            className={loading ? 'opacity-0 pointer-events-none select-none' : 'opacity-100 transition-opacity'}
                            aria-hidden={loading}>
                            {!loading && !hasError && (
                                datasets.length === 0 ? (
                                    <NoResultsMessage/>
                                ) : (
                                    <>
                                        <div className="mb-8">
                                            <div className="mb-4">
                                                <p className="text-gray-600">
                                                    Found {datasets.length} dataset{datasets.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                {datasets.map((dataset, index) => (
                                                    <SearchResultItem
                                                        key={`${dataset._id}-${index}`}
                                                        hit={dataset}
                                                        isLoggedIn={!!user}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <SearchFeedback key={query} query={query}/>
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

export default SearchPage;
