import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { getUserById, UserData } from './lib/userService';
import { checkIsAdmin, AdminData } from './lib/adminService';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import VideoChat from './components/VideoChat';
import AdminDashboard from './components/AdminDashboard';

type PageState = 'login' | 'register' | 'profile' | 'videoChat' | 'admin';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<PageState>('login');
  const [userProfile, setUserProfile] = useState<UserData | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        console.log('User is signed in:', user.email);
        setUser(user);

        // Load user profile from Firestore
        const profile = await getUserById(user.uid);
        setUserProfile(profile);

        // Check if user is an admin
        if (user.email) {
          const adminResult = await checkIsAdmin(user.uid, user.email);
          setIsAdmin(!!adminResult);
          setAdminData(adminResult);
          console.log('Admin check result:', adminResult);
        }

        if (page === 'login' || page === 'register') {
          setPage('videoChat');
        }
      } else {
        console.log('User is signed out');
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
        setAdminData(null);
        setPage('login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [page]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {user ? (
        <>
          <nav className="bg-gray-800 px-6 py-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-white">WorldConnect</h1>
                {isAdmin && (
                  <span className="ml-2 bg-yellow-500 text-xs font-semibold text-black px-2 py-1 rounded-full">
                    {adminData?.role === 'superadmin' ? 'SUPER ADMIN' : 'ADMIN'}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setPage('videoChat')}
                  className={`px-4 py-2 rounded ${page === 'videoChat' ? 'bg-blue-600' : 'bg-transparent hover:bg-gray-700'}`}
                >
                  Video Chat
                </button>
                <button
                  onClick={() => setPage('profile')}
                  className={`px-4 py-2 rounded ${page === 'profile' ? 'bg-blue-600' : 'bg-transparent hover:bg-gray-700'}`}
                >
                  Profile
                </button>
                {/* Only show Admin tab for admins */}
                {isAdmin && (
                  <button
                    onClick={() => setPage('admin')}
                    className={`px-4 py-2 rounded ${page === 'admin' ? 'bg-blue-600' : 'bg-transparent hover:bg-gray-700'}`}
                  >
                    Admin Dashboard
                  </button>
                )}
                <button
                  onClick={() => auth.signOut()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
                >
                  Logout
                </button>
              </div>
            </div>
          </nav>

          <div className="container mx-auto py-8 px-4">
            {page === 'videoChat' && <VideoChat user={user} userProfile={userProfile} />}
            {page === 'profile' && <Profile user={user} />}
            {page === 'admin' && isAdmin && <AdminDashboard user={user} />}
          </div>
        </>
      ) : (
        <div className="flex justify-center items-center min-h-screen">
          <div className="w-full max-w-md">
            {page === 'login' ? (
              <>
                <Login onLogin={() => setPage('videoChat')} />
                <div className="text-center mt-4">
                  <button
                    onClick={() => setPage('register')}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Don't have an account? Register
                  </button>
                </div>
              </>
            ) : (
              <>
                <Register onRegister={() => setPage('videoChat')} />
                <div className="text-center mt-4">
                  <button
                    onClick={() => setPage('login')}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Already have an account? Login
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
