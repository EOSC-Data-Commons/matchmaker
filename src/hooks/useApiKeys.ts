import {useCallback, useEffect, useState} from 'react';
import {
    deleteApiKey,
    getApiKey,
    listApiKeys,
    saveApiKey,
    SecretStoreUnavailableError,
} from '@/lib/apiKeys.ts';
import {getUserErrorMessage} from '@/lib/utils.ts';
import {trackEvent} from '@/lib/analytics.ts';

/**
 * Tracks which API keys the user has configured and exposes save/remove/reveal
 * actions. Pass `enabled` (typically `!authLoading && !!user`) so we only hit the
 * authenticated endpoint once the session is known.
 */
export function useApiKeys(enabled: boolean) {
    const [configured, setConfigured] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [unavailable, setUnavailable] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const ids = await listApiKeys();
            setConfigured(new Set(ids));
            setUnavailable(false);
        } catch (e) {
            if (e instanceof SecretStoreUnavailableError) {
                trackEvent('API Keys', 'store_unavailable');
                setUnavailable(true);
            } else {
                setError(getUserErrorMessage(e));
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        reload().catch(e => console.error(e));
    }, [enabled, reload]);

    // Only the key id ever reaches an event; the value is a secret.
    const save = useCallback(async (id: string, value: string) => {
        const wasConfigured = configured.has(id);
        try {
            await saveApiKey(id, value);
        } catch (e) {
            trackEvent('API Keys', 'save_failed', id);
            throw e;
        }
        trackEvent('API Keys', 'saved', `${id}:${wasConfigured ? 'replace' : 'set'}`);
        setConfigured(prev => new Set(prev).add(id));
    }, [configured]);

    const remove = useCallback(async (id: string) => {
        try {
            await deleteApiKey(id);
        } catch (e) {
            trackEvent('API Keys', 'remove_failed', id);
            throw e;
        }
        trackEvent('API Keys', 'removed', id);
        setConfigured(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const reveal = useCallback((id: string) => getApiKey(id), []);

    return {configured, loading, unavailable, error, save, remove, reveal, reload};
}
