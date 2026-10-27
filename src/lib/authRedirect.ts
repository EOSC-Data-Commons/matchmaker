// Helpers for returning the user to where they were after an interactive login.
//
// The login flow is a full-page redirect through the OIDC provider (`/auth/login`,
// proxied in server.ts). We stash the intended URL in sessionStorage before
// redirecting; it survives the round-trip through the IdP in the same tab. Once
// `useAuth` confirms the user is authenticated it consumes the stash and navigates
// back. No backend change is required.

const POST_LOGIN_REDIRECT_KEY = 'postLoginRedirect';
const AI_MODE_LOGIN_KEY = 'postLoginAiMode';

/**
 * Remember the current location and start the login flow.
 * Call this instead of `window.location.href = '/auth/login'` whenever the user
 * is logging in from a page they should be returned to.
 */
export function loginWithReturn() {
    try {
        sessionStorage.setItem(
            POST_LOGIN_REDIRECT_KEY,
            window.location.pathname + window.location.search,
        );
    } catch {
        // sessionStorage may be unavailable (private mode / blocked) — fall back
        // to a plain login without a return path.
    }
    window.location.href = '/auth/login';
}

/**
 * Read and clear any stashed post-login redirect target.
 * Returns null when there is nothing to return to.
 */
export function consumePostLoginRedirect(): string | null {
    try {
        const target = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
        if (target) {
            sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
        }
        return target;
    } catch {
        return null;
    }
}

/**
 * Start the login flow from the AI Mode toggle. The page the user returns to is
 * marked so that its search bar comes back with AI mode on, instead of making the
 * user click the toggle a second time.
 */
export function loginForAiMode() {
    try {
        sessionStorage.setItem(
            AI_MODE_LOGIN_KEY,
            window.location.pathname + window.location.search,
        );
    } catch {
        // Without sessionStorage the user just has to turn AI mode on again.
    }
    loginWithReturn();
}

/**
 * Whether this page is the one a login from the AI Mode toggle returns to. Only
 * reads the mark: `useAuth` may still send the browser on to the stashed target,
 * and the mark has to survive until that page. `useAuth` clears it there.
 */
export function returnedFromAiModeLogin(): boolean {
    try {
        const target = sessionStorage.getItem(AI_MODE_LOGIN_KEY);
        return !!target && target === window.location.pathname + window.location.search;
    } catch {
        return false;
    }
}

export function clearAiModeLogin() {
    try {
        sessionStorage.removeItem(AI_MODE_LOGIN_KEY);
    } catch {
        // Nothing to clear.
    }
}
