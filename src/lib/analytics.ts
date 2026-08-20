import {RateLimitError, ServerError} from './api.ts';

/** No-ops until `MatomoTracker` has installed `window._paq`, and on the server. */
const push = (cmd: Array<string | number | boolean>) => {
    if (typeof window === 'undefined' || !window._paq) return;
    window._paq.push(cmd as Array<string | number>);
};

/**
 * Pushes a Matomo event. Inside components prefer the `useMatomo` hook, which is
 * a thin wrapper around this; call it directly from the places a hook cannot
 * reach — class components, and module-level code.
 */
export const trackEvent = (category: string, action: string, name?: string, value?: number) => {
    const cmd: Array<string | number> = ['trackEvent', category, action];
    // Matomo reads these positionally, so a value with no name still has to fill
    // the name slot or it lands in the wrong column.
    if (name !== undefined) cmd.push(name);
    else if (value !== undefined) cmd.push('');
    if (value !== undefined) cmd.push(value);
    push(cmd);
};

export const trackPageView = () => push(['trackPageView']);

/**
 * Records one action against Matomo's native Site Search reports, which is what
 * populates "Search Keywords" and "Search Keywords with No Results".
 *
 * Matomo documents this as a replacement for `trackPageView` on a results page,
 * not an addition — `MatomoTracker` suppresses the pageview for the routes
 * `isSiteSearchLocation` matches so exactly one action is recorded either way.
 */
export const trackSiteSearch = (keyword: string, category: string | false, resultCount: number | false) =>
    push(['trackSiteSearch', keyword, category, resultCount]);

/**
 * True for the routes whose pageview is replaced by a site search. Kept next to
 * `trackSiteSearch` so the suppression and the replacement cannot drift apart.
 * An empty `q` is excluded: `useSearchResults` redirects home without searching,
 * so nothing would ever fire the replacement action.
 */
export const isSiteSearchLocation = (pathname: string, search: string): boolean =>
    pathname === '/search' && !!new URLSearchParams(search).get('q');

/**
 * Custom dimension slots. These indices must match the dimensions configured in
 * Matomo under Administration > Websites > Custom Dimensions; a value sent to an
 * index that has not been created there is silently discarded.
 */
export const CustomDimension = {
    /** Visit scope. Separates prod from dev traffic, which share one site id. */
    Environment: 1,
    /** Visit scope. Anonymous vs signed-in, for segmenting every other report. */
    AuthState: 2,
} as const;

export const setCustomDimension = (id: number, value: string) =>
    push(['setCustomDimension', id, value]);

/**
 * Which deployment this bundle is running on. Both report into the same Matomo
 * site id, so without this the two are indistinguishable in every report.
 */
export const currentEnvironment = (): string => {
    if (typeof window === 'undefined') return 'unknown';
    return window.location.hostname.startsWith('dev.') ? 'dev' : 'prod';
};

/**
 * Collapses an error into one of a small, stable set of labels for analytics.
 * Raw error messages carry request ids and status text, which would shatter the
 * Matomo report into thousands of single-occurrence rows.
 */
export const errorKind = (error: unknown): string => {
    if (error instanceof RateLimitError) return 'rate_limit';
    if (error instanceof ServerError) return 'server';
    if (error instanceof Error) {
        if (/timeout|timed out|abort/i.test(error.message)) return 'timeout';
        if (/network|failed to fetch/i.test(error.message)) return 'network';
    }
    return 'unknown';
};
