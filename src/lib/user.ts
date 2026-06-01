import type {UserInfo} from '@/hooks/useAuth.ts';

export function getUserInitials(user: Pick<UserInfo, 'name' | 'preferred_username' | 'email'> | null | undefined): string {
    if (!user) return 'U';

    const name = user.name?.trim();
    if (name) {
        const names = name.split(/\s+/);
        if (names.length >= 2) {
            return (names[0][0] + names[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    const preferredUsername = user.preferred_username?.trim();
    if (preferredUsername) {
        return preferredUsername.substring(0, 2).toUpperCase();
    }

    return user.email?.trim().substring(0, 2).toUpperCase() || 'U';
}

