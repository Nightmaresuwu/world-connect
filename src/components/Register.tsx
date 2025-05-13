import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { upsertUser, getUserByUsername } from '../lib/userService';

interface RegisterProps {
    onRegister?: () => void;
    onRegisterSuccess?: (message: string) => void;
}

const Register: React.FC<RegisterProps> = ({ onRegister, onRegisterSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegistrationSuccess = (message: string) => {
        if (onRegisterSuccess) {
            onRegisterSuccess(message);
        }

        // Navigate to login page
        navigate('/login');
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (!username.trim()) {
            setError('Username is required');
            return;
        }

        // Check if username is already taken
        setLoading(true);
        try {
            const existingUser = await getUserByUsername(username);
            if (existingUser) {
                setError('Username is already taken. Please choose another one.');
                setLoading(false);
                return;
            }

            const credential = await createUserWithEmailAndPassword(auth, email, password);

            // Create user profile in Firestore
            const result = await upsertUser({
                uid: credential.user.uid,
                email: credential.user.email || email,
                username: username,
                isOnline: true
            });

            if (!result) {
                setError('Failed to create user profile. Please try again.');
                return;
            }

            // Successfully registered
            handleRegistrationSuccess(`Account created successfully! You can now sign in as ${username}.`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const credential = await signInWithPopup(auth, provider);

            // Generate a username if not available from Google
            let proposedUsername = credential.user.displayName?.replace(/\s+/g, '_').toLowerCase() ||
                credential.user.email?.split('@')[0] || '';

            // Check if username is already taken
            const existingUser = await getUserByUsername(proposedUsername);
            if (existingUser) {
                // Append a random number if username is taken
                proposedUsername = `${proposedUsername}_${Math.floor(Math.random() * 10000)}`;
            }

            // Create user profile in Firestore
            const result = await upsertUser({
                uid: credential.user.uid,
                email: credential.user.email || '',
                username: proposedUsername,
                avatarUrl: credential.user.photoURL || undefined,
                isOnline: true
            });

            if (!result) {
                setError('Failed to create user profile. Please try again.');
                return;
            }

            // Successfully registered with Google
            handleRegistrationSuccess(`Account created successfully with Google! Your username is ${proposedUsername}.`);
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
                    Create your user account
                </h2>
                <p className="text-center text-sm text-gray-400 mb-4">
                    Note: This registration is for regular users only.
                </p>
            </div>

            {error && (
                <div className="bg-red-500 text-white p-3 rounded my-4">
                    {error}
                </div>
            )}

            <form className="space-y-6" onSubmit={handleEmailAuth}>
                <div className="rounded-md space-y-3">
                    <div>
                        <label htmlFor="username" className="sr-only">Username</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="email-address" className="sr-only">Email address</label>
                        <input
                            id="email-address"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            required
                            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
                        <input
                            id="confirm-password"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {loading ? 'Creating account...' : 'Sign Up'}
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
                        {loading ? 'Connecting...' : 'Sign up with Google'}
                    </button>
                </div>
            </div>

            <div className="mt-6 text-center">
                <p className="text-gray-400">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                        Sign in here
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register; 