import {useState, useEffect} from 'react';
import {UserInfo} from '@/types/user.ts';
import {
    clearAiModeLogin,
    consumeLoginTrigger,
    consumePostLoginRedirect,
    returnedFromAiModeLogin,
} from '@/lib/authRedirect.ts';
import useMatomo from '@/hooks/useMatomo.ts';
import {onceInSession} from '@/lib/analytics.ts';

export type {UserInfo};

const SIGNED_IN_VISIT_KEY = 'signedInVisitReported';

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

                    // Marks the visit as signed in. Several components call this
                    // hook on every page, so it is sent once per tab session, not
                    // once per check. Nothing about the user is sent: a segment on
                    // the event is all the reports need.
                    if (onceInSession(SIGNED_IN_VISIT_KEY)) {
                        trackEvent('Auth', 'signed_in_visit');
                    }

                    // If the user just came back from an interactive login that
                    // was triggered on another page, return them to it.
                    const target = consumePostLoginRedirect();
                    const trigger = consumeLoginTrigger();
                    const current = window.location.pathname + window.location.search;
                    // A pending redirect target is the one reliable marker that this
                    // load is the return leg of an interactive login rather than a
                    // page reload with an existing session. Reported under the same
                    // trigger name as the 'Auth/login_started' that began it, so the
                    // two close the sign-in funnel per entry point.
                    if (target) {
                        trackEvent('Auth', 'login_completed', trigger ?? 'unknown');
                    }
                    if (target && target !== current) {
                        window.location.replace(target);
                    } else if (returnedFromAiModeLogin()) {
                        // Arrived where a login from the AI Mode toggle returns to. The
                        // search bar here read the mark when it mounted, so it can go.
                        clearAiModeLogin();
                    }
                } else {
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
        // Sent with sendBeacon by matomo.js, so it survives the navigation.
        trackEvent('Auth', 'logout');
        window.location.href = '/auth/logout';
    };

    return {user, loading, logout};
}
