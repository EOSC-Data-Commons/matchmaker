import type {BackendDataset} from "../types/commons.ts";
import {CalendarIcon, UserIcon, ExternalLinkIcon, TagIcon, Rocket} from "lucide-react";
import {ProportionalStar} from './ProportionalStar';
import {CitationExport} from './CitationExport';
import {formatPublicationDate, publicationDateOf, sanitizeLinkHref, stripHtml} from "../lib/utils";
import {loginWithReturn} from "../lib/authRedirect";
import {useState} from 'react';
import {useSearchParams} from 'react-router';
import {RepoProvenance} from "./RepoProvenance.tsx";
import useMatomo from "../hooks/useMatomo";

interface SearchResultItemProps {
    hit: BackendDataset;
    isLoggedIn?: boolean;
}

/**
 * OpenSearch's hybrid relevance score, normalised to 0-1 across the result set. Tool
 * registry hits carry a raw rank (20, 19, 18…) instead, so this is clamped rather than
 * rendered as "2000%". Renders nothing when the hit has no score.
 */
export const RelevanceBadge = ({hit}: { hit: BackendDataset }) => {
    if (typeof hit._score !== 'number' || Number.isNaN(hit._score)) return null;
    const scorePercent = Math.min(100, Math.max(0, hit._score * 100));
    return (
        <div
            className="shrink-0 flex items-center space-x-1 bg-yellow-50 px-2 py-1 rounded-full cursor-help"
            title="Relevance score: how closely this result matches your query, combining semantic similarity with keyword matching. It is scaled across this set of results, so it is meant for comparing these results with each other rather than as an absolute measure of quality."
        >
            <ProportionalStar percent={scorePercent} className="h-4 w-4"/>
            <span className="text-sm font-medium text-yellow-700">
                {scorePercent.toFixed(0)}%
            </span>
        </div>
    );
};

/** Description, creators, publication date and subjects of a dataset, as shown on its card. */
export const DatasetDetails = ({hit}: { hit: BackendDataset }) => {
    const [descExpanded, setDescExpanded] = useState(false);
    const [authorsExpanded, setAuthorsExpanded] = useState(false);

    const fullDescription = stripHtml(hit.description || '');
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

    const publicationDate = publicationDateOf(hit);

    return (
        <>
            <div className="mb-4">
                <p className="text-gray-700 leading-relaxed inline break-words">
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
                        <UserIcon className="h-4 w-4 text-gray-500 shrink-0 mt-0.5"/>
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
                        <CalendarIcon className="h-4 w-4 text-gray-500 shrink-0"/>
                        <span className="text-sm text-gray-600">
                            {formatPublicationDate(publicationDate)}
                        </span>
                    </div>
                )}

                {hit._source.subjects && hit._source.subjects.length > 0 && (
                    <div className="flex items-start space-x-2">
                        <TagIcon className="h-4 w-4 text-gray-500 shrink-0 mt-0.5"/>
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
        </>
    );
};

interface DatasetActionsProps {
    hit: BackendDataset;
    isLoggedIn?: boolean;
    // Smaller buttons, to sit in a list row.
    compact?: boolean;
}

/** Play, Source and Cite for a dataset. */
export const DatasetActions = ({hit, isLoggedIn = false, compact = false}: DatasetActionsProps) => {
    const [searchParams] = useSearchParams();
    const {trackEvent} = useMatomo();

    const handleDataplayer = () => {
        if (!isLoggedIn) {
            trackEvent('Auth', 'gate_triggered', 'data_player');
            loginWithReturn();
            return;
        }
        trackEvent('Dataset', 'play_clicked', hit.title);
        const params = new URLSearchParams();
        params.set('datasetId', hit._id);
        if (hit.title) {
            params.set('title', hit.title);
        }
        // The FAIR assessment needs a persistent identifier, and `_id` is only
        // sometimes a DOI. Prefer the real DOI, then the canonical URL, so the
        // dataplayer can run both assessors instead of falling back to F-UJI alone.
        const pid = hit._source?.doi || hit.dataset_url || hit._id;
        if (pid) {
            params.set('pid', pid);
        }
        // Preserve the search query for back navigation
        const currentQuery = searchParams.get('q');
        if (currentQuery) {
            params.set('q', currentQuery);
        }
        window.open(`/dataplayer?${params.toString()}`, '_blank', 'noopener,noreferrer');
    };

    const size = compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';
    const icon = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
    // The id doubles as the dataset's source URL, but it is backend data: link to it only
    // once it is known to be an http(s) address, otherwise leave the button out.
    const sourceHref = sanitizeLinkHref(hit._id);

    return (
        <div className={`flex ${compact ? 'gap-2' : 'space-x-4'}`}>
            <div className="relative group flex items-center">
                <button
                    onClick={handleDataplayer}
                    aria-label={isLoggedIn ? `View dataset for ${hit.title}` : `Sign in to use the data player for ${hit.title}`}
                    className={`inline-flex items-center justify-center gap-1 rounded-md bg-green-600 ${size} font-medium text-white shadow-sm hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 transition-colors cursor-pointer ${!isLoggedIn ? 'opacity-60' : ''}`}>
                    <Rocket className={icon}/>
                    <span className="leading-none">Play</span>
                </button>
                {!isLoggedIn && (
                    <div
                        className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Sign in to use the data player
                    </div>
                )}
            </div>
            {sourceHref && (
                <a href={sourceHref} target="_blank" rel="noopener noreferrer"
                   onClick={() => trackEvent('Dataset', 'source_clicked', hit.title)}
                   aria-label={`Redirect to the source of dataset ${hit.title}`}
                   className={`inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 ${size} font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors cursor-pointer`}>
                    <ExternalLinkIcon className={icon}/>
                    <span className="leading-none">Source</span>
                </a>
            )}
            <CitationExport dataset={hit} compact={compact}/>
        </div>
    );
};

export const SearchResultItem = ({hit, isLoggedIn = false}: SearchResultItemProps) => (
    <div className="rounded-lg shadow-sm border p-6 bg-white border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-gray-900 pr-4 mb-2 sm:mb-0 min-w-0 break-words">
                {hit.title}
            </h3>
            <RelevanceBadge hit={hit}/>
        </div>

        <DatasetDetails hit={hit}/>

        <div
            className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-gray-100 gap-4 sm:gap-0">
            <DatasetActions hit={hit} isLoggedIn={isLoggedIn}/>
            <div className="flex items-center space-x-4">
                <RepoProvenance hit={hit}/>
            </div>
        </div>
    </div>
);
