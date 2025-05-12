import React from 'react';
import { signOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface HeaderProps {
    user: User;
    currentPage: 'chat' | 'profile';
    setCurrentPage: (page: 'chat' | 'profile') => void;
}

const Header: React.FC<HeaderProps> = ({ user, currentPage, setCurrentPage }) => {
    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <header className="bg-gray-800 shadow-md">
            <div className="container mx-auto px-4 py-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center">
                        <h1 className="text-2xl font-bold text-white mr-6">World Connect</h1>
                        <nav className="hidden md:flex space-x-4">
                            <button
                                onClick={() => setCurrentPage('chat')}
                                className={`px-3 py-2 rounded-md text-sm font-medium ${currentPage === 'chat'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                            >
                                Video Chat
                            </button>
                            <button
                                onClick={() => setCurrentPage('profile')}
                                className={`px-3 py-2 rounded-md text-sm font-medium ${currentPage === 'profile'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                            >
                                My Profile
                            </button>
                        </nav>
                    </div>

                    <div className="flex items-center">
                        <div className="flex items-center mr-4">
                            <span className="text-gray-300 text-sm">{user.email}</span>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Mobile navigation */}
                <div className="md:hidden mt-3 flex justify-between">
                    <button
                        onClick={() => setCurrentPage('chat')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium mr-2 ${currentPage === 'chat'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                    >
                        Video Chat
                    </button>
                    <button
                        onClick={() => setCurrentPage('profile')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium ${currentPage === 'profile'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                    >
                        My Profile
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header; 