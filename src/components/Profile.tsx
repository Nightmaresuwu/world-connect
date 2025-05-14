/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { upsertUser, getUserById, UserData } from '../lib/userService';

interface ProfileProps {
    user: User;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
    const [username, setUsername] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [gender, setGender] = useState('');
    const [interests, setInterests] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);

    // Load user data
    useEffect(() => {
        const loadUserData = async () => {
            if (user) {
                const userData = await getUserById(user.uid);
                if (userData) {
                    setUserProfile(userData);
                    setUsername(userData.username || '');
                    setAvatarUrl(userData.avatarUrl || '');
                    setGender(userData.gender || '');
                    setInterests(userData.interests || '');
                } else {
                    // If user doesn't exist, initialize with email
                    setUsername(user.displayName || user.email?.split('@')[0] || '');
                    // Initial save to create the user record
                    await upsertUser({
                        uid: user.uid,
                        email: user.email || '',
                        username: user.displayName || user.email?.split('@')[0] || '',
                    });
                }
            }
        };

        loadUserData();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const success = await upsertUser({
                uid: user.uid,
                email: user.email || '',
                username,
                avatarUrl,
                gender,
                interests
            });

            if (success) {
                setSuccess(true);
                setIsEditing(false);

                // Refresh user data
                const userData = await getUserById(user.uid);
                if (userData) {
                    setUserProfile(userData);
                }

                // Reset success message after 3 seconds
                setTimeout(() => {
                    setSuccess(false);
                }, 3000);
            } else {
                throw new Error("Failed to update profile");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <div className="px-6 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-white">My Profile</h2>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>

                {success && (
                    <div className="mb-6 p-3 bg-green-600 text-white rounded">
                        Profile updated successfully!
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-3 bg-red-600 text-white rounded">
                        Error updating profile: {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-gray-300 mb-2">Email</label>
                            <input
                                type="email"
                                value={user.email || ''}
                                disabled
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 mb-2">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={!isEditing}
                                required
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white disabled:opacity-60"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 mb-2">Avatar URL</label>
                            <input
                                type="url"
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                disabled={!isEditing}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white disabled:opacity-60"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 mb-2">Gender</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                disabled={!isEditing}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white disabled:opacity-60"
                            >
                                <option value="">Prefer not to say</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-300 mb-2">Interests (separate with commas)</label>
                        <textarea
                            value={interests}
                            onChange={(e) => setInterests(e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white h-32 disabled:opacity-60"
                            placeholder="Music, Travel, Movies, etc."
                        />
                    </div>

                    {isEditing && (
                        <div className="flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-60"
                            >
                                {loading ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    )}
                </form>

                {avatarUrl && (
                    <div className="mt-8">
                        <h3 className="text-xl font-semibold text-white mb-4">Profile Preview</h3>
                        <div className="flex items-center p-4 bg-gray-700 rounded">
                            <img
                                src={avatarUrl}
                                alt="Profile Avatar"
                                className="w-16 h-16 rounded-full object-cover mr-4"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = 'https://via.placeholder.com/150?text=Avatar';
                                }}
                            />
                            <div>
                                <p className="text-white font-bold">{username || 'Username'}</p>
                                <p className="text-gray-300">{gender || 'No gender specified'}</p>
                                <p className="text-gray-400 text-sm mt-1">{interests || 'No interests specified'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile; 