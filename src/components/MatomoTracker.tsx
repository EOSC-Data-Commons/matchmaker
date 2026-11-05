import {useEffect, useRef} from 'react';
import {useLocation} from 'react-router';
import {analyticsEnabled, pageTitle, siteSearchKeyword, trackedUrl, trackPageView} from '@/lib/analytics.ts';

declare global {
    interface Window {
        // Booleans are part of Matomo's own command vocabulary: trackSiteSearch
        // takes `false` for an unknown result count.
        _paq: Array<Array<string | number | boolean> | ((this: void) => void)>;
    }
}

const MatomoTracker = () => {
    const location = useLocation();
    // The keyword whose pageview has already been held back for `useSearchResults`
    // to report. Cleared on leaving the results page so returning to the same
    // query is suppressed again rather than double-counted.
    const reportedBySearchRef = useRef<string | null>(null);

    useEffect(() => {
        window._paq = window._paq || [];
        // Cookieless by choice, so no consent banner is needed. The cost is that
        // Matomo recognises a visitor for one day at most, so "returning visitor"
        // only means within that day. Has to come before the first tracking call.
        window._paq.push(['disableCookies']);
        window._paq.push(['enableLinkTracking']);
        // Without this, Matomo derives time-on-page from the gap between
        // pageviews, so the last page of every visit counts as zero seconds.
        // With a bounce rate near 43% that understates time on site badly.
        window._paq.push(['enableHeartBeatTimer', 15]);
        // The command queue is still built when sending is off, so `window._paq`
        // can be read in the console while developing, but without matomo.js
        // nothing in it is ever sent.
        if (!analyticsEnabled(window.location.hostname, window.location.search)) return;
        (function () {
            const u = "https://egi.matomo.cloud/";
            window._paq.push(['setTrackerUrl', u + 'matomo.php']);
            window._paq.push(['setSiteId', '10']);
            const d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
            g.async = true;
            g.src = 'https://cdn.matomo.cloud/egi.matomo.cloud/matomo.js';
            if (s && s.parentNode) {
                s.parentNode.insertBefore(g, s);
            }
        })();
    }, []);

    useEffect(() => {
        if (!window._paq) return;
        window._paq.push(['setCustomUrl', trackedUrl(location.pathname, location.search)]);
        window._paq.push(['setDocumentTitle', pageTitle(location.pathname)]);

        const keyword = siteSearchKeyword(location.pathname, location.search);
        if (keyword === null) {
            reportedBySearchRef.current = null;
            trackPageView();
            // Links rendered by the new route are not known to the listener
            // installed on load. Matomo skips links it has already wired up, so
            // repeating this is safe.
            window._paq.push(['enableLinkTracking']);
            return;
        }
        // A keyword we have not reported yet means a real search is running, and
        // `useSearchResults` will record it with its hit count. Matomo counts a
        // site search instead of a pageview, not as well as one, so hold this back.
        if (keyword !== reportedBySearchRef.current) {
            reportedBySearchRef.current = keyword;
            return;
        }
        // Same keyword, different URL: a filter changed. Filtering is client-side,
        // so nothing is fetched, and `Search/filter_*` records the action. A
        // pageview here would be filed by Matomo as another search for the same
        // keyword, which is what used to inflate "searches" per keyword.
    }, [location]);

    return null;
};

export default MatomoTracker;
