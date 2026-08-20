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
 * Records one action against Matomo's native Site Search reports. Site search is
 * already enabled on site id 10 and Matomo auto-detects the `q` parameter, so
 * `/search?q=...` is counted as a search today — but with no result count, which
 * is what leaves "Search Keywords with No Results" empty. Supplying the count is
 * the whole point of calling this explicitly.
 *
 * Matomo documents it as a replacement for `trackPageView`, not an addition, so
 * `MatomoTracker` holds the pageview back for the navigation this reports on.
 */
export const trackSiteSearch = (keyword: string, category: string | false, resultCount: number | false) =>
    push(['trackSiteSearch', keyword, category, resultCount]);

/**
 * The search keyword a location represents, or null if it is not a results page.
 * Kept next to `trackSiteSearch` so the pageview suppression and the replacement
 * action cannot drift apart. An empty `q` is excluded: it redirects home without
 * searching, and Matomo already files those under Pages rather than Site Search.
 */
export const siteSearchKeyword = (pathname: string, search: string): string | null =>
    pathname === '/search' ? (new URLSearchParams(search).get('q') || null) : null;

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
