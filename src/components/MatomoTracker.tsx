import {useEffect} from 'react';
import {useLocation} from 'react-router';
import {
    CustomDimension,
    currentEnvironment,
    isSiteSearchLocation,
    setCustomDimension,
    trackPageView,
} from '@/lib/analytics.ts';

declare global {
    interface Window {
        _paq: Array<Array<string | number> | ((this: void) => void)>;
    }
}

const MatomoTracker = () => {
    const location = useLocation();

    useEffect(() => {
        window._paq = window._paq || [];
        window._paq.push(['enableLinkTracking']);
        // Without this, Matomo derives time-on-page from the gap between
        // pageviews, so the last page of every visit counts as zero seconds.
        // With a bounce rate near 43% that understates time on site badly.
        window._paq.push(['enableHeartBeatTimer', 15]);
        // Set before the first action so it is attached to it. Visit-scoped, so
        // one call per page load is enough.
        setCustomDimension(CustomDimension.Environment, currentEnvironment());
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
        // The results page records a site search instead of a pageview — Matomo
        // treats the two as alternatives, and `useSearchResults` fires the
        // replacement once it knows how many hits came back.
        if (isSiteSearchLocation(location.pathname, location.search)) return;
        trackPageView();
    }, [location]);

    return null;
};

export default MatomoTracker;
