import {useState, useEffect} from 'react';
import {UserInfo} from '@/types/user.ts';
import {consumePostLoginRedirect} from '@/lib/authRedirect.ts';

export type {UserInfo};

export function useAuth() {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/auth/user');
                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData);

                    // If the user just came back from an interactive login that
                    // was triggered on another page, return them to it.
                    const target = consumePostLoginRedirect();
                    const current = window.location.pathname + window.location.search;
                    if (target && target !== current) {
                        window.location.replace(target);
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
    }, []);

    const logout = () => {
        window.location.href = '/auth/logout';
    };

    return {user, loading, logout};
}

