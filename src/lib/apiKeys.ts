import {fetchWithTimeout, logError} from './utils.ts';

// Per-user API keys live in the EGI Secret Store (HashiCorp Vault) and are reached
// through the `/auth/*` proxy in `server.ts` (same-origin on the matchmaker domain).
// Auth is cookie-based: the httpOnly `access_token` cookie is sent with every request
// (`credentials: 'include'`), matching the backend's `curl --cookie` examples.
// Docs: https://github.com/EOSC-Data-Commons/data-commons-search#-secrets-store
const KEYS_API_URL = '/auth/keys';
const REQUEST_TIMEOUT_MS = 15000;

// Feature flag: gates the entry point in the UI. Mirrors the `VITE_SHOW_MODEL_SELECTOR`
// pattern in `SearchInput.tsx`.
export const API_KEYS_ENABLED = import.meta.env.VITE_ENABLE_API_KEYS === 'true';

export interface ApiKeyMeta {
    id: string;
    label: string;
    description: string;
    helpUrl: string;
    placeholder: string;
}

// NOTE: `id` is the Vault key_id (the path segment). Backend code that reads these
// secrets must use the same ids — keep in sync with the data-commons-search project.
export const API_KEYS: ApiKeyMeta[] = [
    {
        id: 'vip',
        label: 'VIP API Key',
        description: 'Lets the dataplayer interoperate with VIP on your behalf.',
        helpUrl: 'https://vip.creatis.insa-lyon.fr/',
        placeholder: 'Paste your VIP API key',
    },
    {
        id: 'github',
        label: 'GitHub Personal Access Token',
        description: 'Used for GitHub API requests so you do not hit the unauthenticated rate limit.',
        helpUrl: 'https://github.com/settings/tokens',
        placeholder: 'ghp_…',
    },
];

/** Raised when the Secret Store backend is unreachable or not yet enabled. */
export class SecretStoreUnavailableError extends Error {
    constructor(message?: string) {
        super(message || 'The secret store is not available right now. Please try again later.');
        this.name = 'SecretStoreUnavailableError';
    }
}

/** Same-origin requests with the httpOnly auth cookie attached. */
const REQUEST_INIT: RequestInit = {credentials: 'include', cache: 'no-store'};

/** Best-effort extraction of a backend error message (FastAPI `detail`, or status text). */
async function parseError(response: Response): Promise<string> {
    try {
        const data = await response.json();
        if (data && typeof data.detail === 'string') return data.detail;
    } catch {
        // Non-JSON body (e.g. the proxy's plain-text "Proxy error") — fall through.
    }
    return `${response.status} ${response.statusText}`.trim();
}

interface ApiKeyListResponse {
    key_ids: string[];
}

// Prod runs the "old verbose" schema ({ key_id, key_value }); the newer schema returns
// ({ id, value }). Accept both so a backend rollout doesn't break the UI.
interface ApiKeyResponse {
    id?: string;
    value?: string;
    key_id?: string;
    key_value?: string;
}

/**
 * List the ids of the keys the user has stored (values are not returned).
 * A 404/5xx here means the route is not mounted or the store is unreachable —
 * surfaced as {@link SecretStoreUnavailableError} so the UI can degrade gracefully.
 */
export async function listApiKeys(): Promise<string[]> {
    let response: Response;
    try {
        response = await fetchWithTimeout(KEYS_API_URL, REQUEST_INIT, REQUEST_TIMEOUT_MS);
    } catch (error) {
        logError(error, 'API Keys list');
        throw new SecretStoreUnavailableError();
    }
    if (response.status === 401) {
        throw new Error('You must be logged in to manage API keys.');
    }
    if (!response.ok) {
        throw new SecretStoreUnavailableError(await parseError(response));
    }
    const data = await response.json() as ApiKeyListResponse;
    return data.key_ids ?? [];
}

/** Read a single stored key value (used by the reveal action). */
export async function getApiKey(id: string): Promise<string> {
    const response = await fetchWithTimeout(
        `${KEYS_API_URL}/${encodeURIComponent(id)}`,
        REQUEST_INIT,
        REQUEST_TIMEOUT_MS,
    );
    if (response.status === 404) {
        throw new Error('This key is not set.');
    }
    if (!response.ok) {
        throw new Error(await parseError(response));
    }
    const data = await response.json() as ApiKeyResponse;
    const value = data.value ?? data.key_value;
    if (value == null) {
        throw new Error('Unexpected response from secret store.');
    }
    return value;
}

/** Create or replace a stored key value. */
export async function saveApiKey(id: string, value: string): Promise<void> {
    const response = await fetchWithTimeout(
        `${KEYS_API_URL}/${encodeURIComponent(id)}`,
        {
            ...REQUEST_INIT,
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({key_value: value}),
        },
        REQUEST_TIMEOUT_MS,
    );
    if (!response.ok) {
        throw new Error(await parseError(response));
    }
}

/** Permanently delete a stored key. */
export async function deleteApiKey(id: string): Promise<void> {
    const response = await fetchWithTimeout(
        `${KEYS_API_URL}/${encodeURIComponent(id)}`,
        {...REQUEST_INIT, method: 'DELETE'},
        REQUEST_TIMEOUT_MS,
    );
    if (!response.ok) {
        throw new Error(await parseError(response));
    }
}
