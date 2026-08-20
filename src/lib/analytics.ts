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
