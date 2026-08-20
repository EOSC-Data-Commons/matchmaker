import {useEffect} from 'react';
import {useLocation} from 'react-router';

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
        if (window._paq) {
            window._paq.push(['setCustomUrl', location.pathname + location.search]);
            window._paq.push(['trackPageView']);
        }
    }, [location]);

    return null;
};

export default MatomoTracker;
