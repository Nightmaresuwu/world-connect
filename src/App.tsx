import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import './App.css';
import Login from './components/Login';
import Header from './components/Header';
import VideoChat from './components/VideoChat';
import Profile from './components/Profile';
import { auth } from './lib/firebase';
import { getUserById, UserData } from './lib/userService';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserData | null>(null);
  const [currentPage, setCurrentPage] = useState<'chat' | 'profile'>('chat');

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load user profile when user changes
  useEffect(() => {
    if (user) {
      const loadUserProfile = async () => {
        const profile = await getUserById(user.uid);
        setUserProfile(profile);
      };

      loadUserProfile();
    } else {
      setUserProfile(null);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header
        user={user}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />

      <main className="container mx-auto px-4 py-6">
        {currentPage === 'chat' ? (
          <VideoChat user={user} userProfile={userProfile} />
        ) : (
          <Profile user={user} />
        )}
      </main>
    </div>
  );
}

export default App;
