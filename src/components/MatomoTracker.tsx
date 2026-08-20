import {useEffect, useRef} from 'react';
import {useLocation} from 'react-router';
import {siteSearchKeyword, trackPageView} from '@/lib/analytics.ts';

declare global {
    interface Window {
        // Booleans are part of Matomo's own command vocabulary: trackSiteSearch
        // takes `false` for an omitted category or an unknown result count.
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
        window._paq.push(['enableLinkTracking']);
        // Without this, Matomo derives time-on-page from the gap between
        // pageviews, so the last page of every visit counts as zero seconds.
        // With a bounce rate near 43% that understates time on site badly.
        window._paq.push(['enableHeartBeatTimer', 15]);
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
        window._paq.push(['setCustomUrl', location.pathname + location.search]);

        const keyword = siteSearchKeyword(location.pathname, location.search);
        if (keyword === null) {
            reportedBySearchRef.current = null;
            trackPageView();
            return;
        }
        // A keyword we have not reported yet means a real search is running, and
        // `useSearchResults` will record it with its hit count. Matomo counts a
        // site search instead of a pageview, not as well as one, so hold this back.
        if (keyword !== reportedBySearchRef.current) {
            reportedBySearchRef.current = keyword;
            return;
        }
        // Same keyword, different URL: a filter changed. Filtering is client-side
        // so `useSearchResults` does not re-run, and without this the action would
        // be lost entirely. Matomo's own `q` detection files it as a search, which
        // is how these have always been counted.
        trackPageView();
    }, [location]);

    return null;
};

export default MatomoTracker;
