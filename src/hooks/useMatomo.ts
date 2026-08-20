import {trackEvent} from '@/lib/analytics.ts';

/**
 * Component-facing handle on Matomo event tracking. `trackEvent` is a
 * module-level function, so its identity is stable across renders and it is safe
 * to list in a hook dependency array.
 */
const useMatomo = () => ({trackEvent});

export default useMatomo;
