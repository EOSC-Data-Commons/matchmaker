import {useState, useRef, useEffect} from 'react';
import {UserInfo} from '../hooks/useAuth';

interface UserMenuProps {
    user: UserInfo;
    onLogout: () => void;
}

export const UserMenu = ({user, onLogout}: UserMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const getInitials = () => {
        if (user.name) {
            const names = user.name.split(' ');
            if (names.length >= 2) {
                return (names[0][0] + names[1][0]).toUpperCase();
            }
            return user.name.substring(0, 2).toUpperCase();
        }
        if (user.preferred_username) {
            return user.preferred_username.substring(0, 2).toUpperCase();
        }
        return user.email.substring(0, 2).toUpperCase();
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-9 h-9 rounded-full bg-[#002337] text-white flex items-center justify-center font-medium hover:bg-opacity-90 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#009FE3]"
                title={user.name || user.email}
            >
                {getInitials()}
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-eosc-border py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {user.name || user.preferred_username}
                        </p>
                        <p className="text-xs text-eosc-gray truncate mt-0.5">
                            {user.email}
                        </p>
                    </div>
                    <div className="py-1">
                        <button
                            onClick={onLogout}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                        >
                            <svg
                                className="w-4 h-4 text-gray-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                            </svg>
                            Log out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
