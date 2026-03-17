import {useState, useEffect} from 'react';

export interface UserInfo {
    sub: string;
    email: string;
    name?: string;
    preferred_username?: string;
}

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

        checkAuth();
    }, []);

    const logout = () => {
        window.location.href = '/auth/logout';
    };

    return {user, loading, logout};
}

