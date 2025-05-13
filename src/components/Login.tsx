import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { findUserByCredentials } from '../lib/userService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface LoginProps {
    onLogin?: () => void;
    registrationMessage?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, registrationMessage }) => {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

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
            let userEmail = loginId;
            let isAdmin = false;

            // First, check if this is an admin account
            try {
                // Try to find admin by username or email
                const adminId = isEmail ? loginId.toLowerCase() : loginId.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
                const adminQuery = doc(db, "admins", adminId);
                const adminDoc = await getDoc(adminQuery);

                if (adminDoc.exists() && adminDoc.data().email) {
                    // If admin exists, use their email for login
                    userEmail = adminDoc.data().email;
                    isAdmin = true;
                }
            } catch (adminErr) {
                // Not an admin, continue with regular user login
                console.log("Not an admin account, continuing with regular login");
            }

            if (!isEmail && !isAdmin) {
                // If not an admin and not an email, try to find user by username
                const user = await findUserByCredentials(loginId);
                if (!user || !user.email) {
                    throw new Error('User not found. Please check your username or email.');
                }
                userEmail = user.email;
            }

            // Sign in with email and password
            await signInWithEmailAndPassword(auth, userEmail, password);

            // Redirect based on account type
            if (isAdmin) {
                setMessage('Login successful!');
                navigate('/admin');
            } else {
                navigate('/videoChat');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);

            // Check if this Google account is an admin
            if (result.user && result.user.email) {
                try {
                    const adminQuery = doc(db, "admins", result.user.email.toLowerCase());
                    const adminDoc = await getDoc(adminQuery);

                    if (adminDoc.exists()) {
                        // This is an admin account
                        navigate('/admin');
                        return;
                    }
                } catch (err) {
                    // Not an admin, continue as regular user
                }
            }

            // Regular user login
            navigate('/videoChat');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8">
            <div>
                <h2 className="text-center text-2xl font-bold text-blue-400 mb-4">
                    Sign in to your account
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
                            placeholder="Email or Username"
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

            <div className="mt-6 text-center">
                <p className="text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
                        Sign up here
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login; 