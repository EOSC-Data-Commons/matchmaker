import type {BackendDataset} from "../types/commons.ts";
import {CalendarIcon, UserIcon, ExternalLinkIcon, TagIcon, Rocket} from "lucide-react";
import {ProportionalStar} from './ProportionalStar';
import {CitationExport} from './CitationExport';
import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {RepoLogo} from "./RepoLogo.tsx";

interface SearchResultItemProps {
    hit: BackendDataset;
    isAiRanked?: boolean;
}

export const SearchResultItem = ({hit, isAiRanked = false}: SearchResultItemProps) => {
    const [searchParams] = useSearchParams();

    const cleanDescription = (html: string) => {
        const div = document.createElement('div');
        div.innerHTML = html;
        const text = div.textContent || div.innerText || '';
        return text; // return full cleaned text; truncation handled in render
    };

    const [descExpanded, setDescExpanded] = useState(false);
    const [authorsExpanded, setAuthorsExpanded] = useState(false);

    const handleRunDispatcher = () => {
        // Open the dispatcher run page in a new tab with dataset info
        const params = new URLSearchParams();
        params.set('datasetId', hit._id);
        if (hit.title) {
            params.set('title', hit.title);
        }
        // Preserve the search query for back navigation
        const currentQuery = searchParams.get('q');
        if (currentQuery) {
            params.set('q', currentQuery);
        }
        window.open(`/dispatcher/run?${params.toString()}`, '_blank');
    };

    const scorePercent = (hit.score || 0) * 100;

    const getPublicationDate = (): string | null => {
        // First priority: root-level publicationDate field (if not null)
        if (hit.publication_date) {
            return hit.publication_date;
        }

        // Last resort: use publicationYear if available (show just the year)
        if (hit._source.publicationYear) {
            return hit._source.publicationYear;
        }

        return null;
    };

    const publicationDate = getPublicationDate();

    const formatDate = (dateStr: string): string => {
        // If it's just a year (4 digits), return as-is
        if (/^\d{4}$/.test(dateStr)) {
            return dateStr;
        }
        // Otherwise format as YYYY.MM.DD
        return new Date(dateStr).toISOString().slice(0, 10).replace(/-/g, '.');
    };


    const fullDescription = cleanDescription(hit.description || '');
    const descLimit = 300;
    const isDescTruncated = fullDescription.length > descLimit;
    const visibleDescription = descExpanded || !isDescTruncated
        ? fullDescription
        : fullDescription.slice(0, descLimit) + '...';


    const creators = hit._source.creators || [];
    const baseAuthorsToShow = 3;
    const showAllAuthors = authorsExpanded || creators.length <= baseAuthorsToShow;
    const visibleCreators = showAllAuthors ? creators : creators.slice(0, baseAuthorsToShow);
    const remainingAuthors = Math.max(0, creators.length - baseAuthorsToShow);

    return (
        <div className={`rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow ${
            isAiRanked
                ? 'bg-white border-gray-200'
                : 'bg-gray-100 border-gray-300'
        }`}>
            <div className="flex flex-col sm:flex-row justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-900 pr-4 mb-2 sm:mb-0">
                    {hit.title}
                </h3>
                {isAiRanked && hit.score !== undefined && (
                    <div
                        className="flex-shrink-0 flex items-center space-x-1 bg-yellow-50 px-2 py-1 rounded-full cursor-help"
                        title="AI-powered relevance score: Ranked by LLM based on semantic understanding of your query. Scores range from 0% (low relevance) to 100% (high relevance)."
                    >
                        <ProportionalStar percent={scorePercent} className="h-4 w-4"/>
                        <span className="text-sm font-medium text-yellow-700">
                            {scorePercent.toFixed(0)}%
                        </span>
                    </div>
                )}
                {!isAiRanked && typeof hit._score === 'number' && !Number.isNaN(hit._score) && (
                    <div
                        className="flex-shrink-0 flex items-center space-x-1 bg-blue-50 px-2 py-1 rounded-full cursor-help"
                        title="OpenSearch relevance score: Based on keyword matching and text analysis. Scores range from 0% (low match) to 100% (high match)."
                    >
                        <ProportionalStar percent={(hit._score || 0) * 100} className="h-4 w-4" color="#005EB8"/>
                        <span className="text-sm font-semibold" style={{color: '#005EB8'}}>
                            {(((hit._score || 0) * 100)).toFixed(0)}%
                        </span>
                    </div>
                )}
            </div>

            <div className="mb-4">
                <p className="text-gray-700 leading-relaxed inline">
                    {visibleDescription}
                </p>
                {isDescTruncated && (
                    <button
                        type="button"
                        onClick={() => setDescExpanded(v => !v)}
                        aria-expanded={descExpanded}
                        className="ml-2 text-blue-700 hover:text-blue-800 hover:underline text-sm font-medium align-baseline cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        {descExpanded ? 'Show less' : 'Show more'}
                    </button>
                )}
            </div>

            <div className="space-y-2 mb-4">
                {creators.length > 0 && (
                    <div className="flex items-start space-x-2">
                        <UserIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5"/>
                        <div>
                            <span className="text-sm text-gray-600">
                                {visibleCreators.map(c => c.creatorName).join(', ')}
                                {!showAllAuthors && remainingAuthors > 0 && `, +${remainingAuthors} more`}
                            </span>
                            {creators.length > baseAuthorsToShow && (
                                <button
                                    type="button"
                                    onClick={() => setAuthorsExpanded(v => !v)}
                                    aria-expanded={authorsExpanded}
                                    className="ml-2 text-blue-700 hover:text-blue-800 hover:underline text-xs font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                >
                                    {authorsExpanded ? 'Show less' : 'Show all'}
                                </button>
                            )}
                        </div>
                    </div>
                )}


                {publicationDate && (
                    <div className="flex items-center space-x-2">
                        <CalendarIcon className="h-4 w-4 text-gray-500 flex-shrink-0"/>
                        <span className="text-sm text-gray-600">
                            {formatDate(publicationDate)}
                        </span>
                    </div>
                )}

                {hit._source.subjects && hit._source.subjects.length > 0 && (
                    <div className="flex items-start space-x-2">
                        <TagIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5"/>
                        <div className="flex flex-wrap gap-1">
                            {hit._source.subjects.slice(0, 5).map((subj, index) => (
                                <span key={index}
                                      className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                                    {subj.subject}
                                </span>
                            ))}
                            {hit._source.subjects.length > 5 && (
                                <span className="text-xs text-gray-500">
                                    +{hit._source.subjects.length - 5} more
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div
                className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-gray-100 gap-4 sm:gap-0">
                <div className="flex space-x-4">
                    <button
                        onClick={handleRunDispatcher}
                        aria-label={`Run dispatcher for ${hit.title}`}
                        className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors cursor-pointer">
                        <Rocket className="h-4 w-4"/>
                        <span className="leading-none">Run</span>
                    </button>
                    <a href={hit._id} target="_blank" rel="noopener noreferrer"
                       aria-label={`View dataset ${hit.title}`}
                       className="inline-flex items-center justify-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 transition-colors">
                        <ExternalLinkIcon className="h-4 w-4"/>
                        <span className="leading-none">View</span>
                    </a>
                    <CitationExport dataset={hit}/>
                </div>
                <div className="flex items-center space-x-4">
                    {hit._source._repo && <RepoLogo repo={hit._source._repo}/>}
                    {isAiRanked && (
                        <span
                            className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">AI-powered search</span>
                    )}
                </div>
            </div>
        </div>
    );
};