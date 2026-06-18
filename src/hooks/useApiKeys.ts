import {useCallback, useEffect, useState} from 'react';
import {
    deleteApiKey,
    getApiKey,
    listApiKeys,
    saveApiKey,
    SecretStoreUnavailableError,
} from '@/lib/apiKeys.ts';
import {getUserErrorMessage} from '@/lib/utils.ts';

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

    const save = useCallback(async (id: string, value: string) => {
        await saveApiKey(id, value);
        setConfigured(prev => new Set(prev).add(id));
    }, []);

    const remove = useCallback(async (id: string) => {
        await deleteApiKey(id);
        setConfigured(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const reveal = useCallback((id: string) => getApiKey(id), []);

    return {configured, loading, unavailable, error, save, remove, reveal, reload};
}
