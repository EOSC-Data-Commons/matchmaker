import {useCallback, useSyncExternalStore} from "react";

/**
 * Tracks whether a CSS media query currently matches.
 *
 * Returns `false` during SSR and on the first hydration render, so server and
 * client markup agree. Phrase queries so that `false` is the desktop answer
 * (e.g. `(max-width: 639px)` rather than `(min-width: 640px)`) and narrow
 * viewports settle to the correct value right after hydration.
 */
export const useMediaQuery = (query: string): boolean => {
    const subscribe = useCallback((onStoreChange: () => void) => {
        if (typeof window === 'undefined' || !window.matchMedia) return () => {
        };
        const mql = window.matchMedia(query);
        mql.addEventListener('change', onStoreChange);
        return () => mql.removeEventListener('change', onStoreChange);
    }, [query]);

    const getSnapshot = useCallback(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia(query).matches;
    }, [query]);

    return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
