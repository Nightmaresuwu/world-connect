import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { findUserByCredentials } from '../lib/userService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface LoginProps {
    onLogin?: () => void;
    onAdminModeChange?: (isAdminMode: boolean) => void;
    registrationMessage?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, onAdminModeChange, registrationMessage }) => {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isAdminMode, setIsAdminMode] = useState(false);

    // Notify parent component when admin mode changes
    useEffect(() => {
        if (onAdminModeChange) {
            onAdminModeChange(isAdminMode);
        }
    }, [isAdminMode, onAdminModeChange]);

    // Set registration message if provided
    useEffect(() => {
        if (registrationMessage) {
            setMessage(registrationMessage);
        }
    }, [registrationMessage]);

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        setMessage('');

        try {
            const isEmail = loginId.includes('@');

            if (isAdminMode) {
                // Admin login attempt - try direct email login or by username (stored in adminId)
                try {
                    if (isEmail) {
                        // Direct login with email
                        await signInWithEmailAndPassword(auth, loginId, password);
                    } else {
                        // Try to find admin by username
                        const adminQuery = doc(db, "admins", loginId.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_'));
                        const adminDoc = await getDoc(adminQuery);

                        if (adminDoc.exists() && adminDoc.data().email) {
                            // Admin exists, log in with their email
                            await signInWithEmailAndPassword(auth, adminDoc.data().email, password);
                        } else {
                            throw new Error('Admin not found with this username');
                        }
                    }
                    setMessage('Admin login successful!');
                    if (onLogin) onLogin();
                } catch (adminErr: any) {
                    console.error('Admin login error:', adminErr);
                    setError('Admin login failed: ' + adminErr.message);
                }
            } else {
                // Regular user login
                if (isEmail) {
                    // Direct login with email if it looks like an email
                    await signInWithEmailAndPassword(auth, loginId, password);
                    if (onLogin) onLogin();
                } else {
                    // Find the user by username to get their email
                    const user = await findUserByCredentials(loginId);

                    if (!user || !user.email) {
                        setError('User not found. Please check your username or email.');
                    } else {
                        // User found, sign in with their email
                        await signInWithEmailAndPassword(auth, user.email, password);
                        if (onLogin) onLogin();
                    }
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        if (isAdminMode) {
            setError('Google Sign-in is not available for Admin accounts. Please use email/username and password.');
            return;
        }

        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            if (onLogin) onLogin();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-gray-800 rounded-b-lg shadow-lg p-8">
            <div>
                <h2 className="text-center text-2xl font-bold text-blue-400 mb-4">
                    {isAdminMode ? 'Admin Login' : 'Sign in to your account'}
                </h2>
            </div>

            {error && (
                <div className="bg-red-500 text-white p-3 rounded my-4">
                    {error}
                </div>
            )}

            {message && (
                <div className="bg-green-500 text-white p-3 rounded my-4">
                    {message}
                </div>
            )}

            <div className="mb-6">
                <div className="flex justify-center space-x-2">
                    <button
                        type="button"
                        onClick={() => setIsAdminMode(false)}
                        className={`px-4 py-2 rounded-md ${!isAdminMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        User
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsAdminMode(true)}
                        className={`px-4 py-2 rounded-md ${isAdminMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        Admin
                    </button>
                </div>
            </div>

            <form className="space-y-6" onSubmit={handleEmailAuth}>
                <div className="rounded-md -space-y-px">
                    <div>
                        <label htmlFor="login-id" className="sr-only">Email or Username</label>
                        <input
                            id="login-id"
                            name="loginId"
                            type="text"
                            autoComplete="email username"
                            required
                            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder={isAdminMode ? "Admin Email or Username" : "Email or Username"}
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </div>
            </form>

            {!isAdminMode && (
                <div className="mt-6">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-600"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-gray-800 text-white">Or continue with</span>
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={handleGoogleAuth}
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                        >
                            {loading ? 'Connecting...' : 'Sign in with Google'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login; 