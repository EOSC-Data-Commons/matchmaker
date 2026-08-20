import {useState, useEffect} from 'react';
import {UserInfo} from '@/types/user.ts';
import {consumePostLoginRedirect} from '@/lib/authRedirect.ts';
import useMatomo from '@/hooks/useMatomo.ts';
import {CustomDimension, setCustomDimension} from '@/lib/analytics.ts';

export type {UserInfo};

export function useAuth() {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const {trackEvent} = useMatomo();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/auth/user');
                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData);
                    // Visit-scoped, so it attaches to the visit even though auth
                    // resolves after the first pageview has already gone out.
                    setCustomDimension(CustomDimension.AuthState, 'signed_in');

                    // If the user just came back from an interactive login that
                    // was triggered on another page, return them to it.
                    const target = consumePostLoginRedirect();
                    const current = window.location.pathname + window.location.search;
                    // A pending redirect target is the one reliable marker that this
                    // load is the return leg of an interactive login rather than a
                    // page reload with an existing session. It pairs with the
                    // 'Auth/gate_triggered' events to close the sign-in funnel.
                    // Only the path is reported: the query string carries the user's
                    // search terms, which do not belong on an auth event.
                    if (target) {
                        trackEvent('Auth', 'login_completed', target.split('?')[0]);
                    }
                    if (target && target !== current) {
                        window.location.replace(target);
                    }
                } else {
                    setCustomDimension(CustomDimension.AuthState, 'anonymous');
                    setUser(null);
                }
            } catch (error) {
                console.error('Failed to fetch user info:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkAuth().then(r => r).catch(e => console.error(e));
    }, [trackEvent]);

    const logout = () => {
        window.location.href = '/auth/logout';
    };

    return {user, loading, logout};
}

