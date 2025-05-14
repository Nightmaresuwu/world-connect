import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { auth } from './lib/firebase';
import { getUserById, UserData } from './lib/userService';
import { checkIsAdmin, AdminData } from './lib/adminService';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import VideoChat from './components/VideoChat';
import AdminDashboard from './components/AdminDashboard';
import logo from './logo.svg';
import LoadingSpinner from './components/LoadingSpinner';

// Layout components
const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary-gradient text-white">
      <div className="w-full max-w-md mb-6 flex flex-col items-center">
        <img src={logo} alt="World Connect Logo" className="App-logo w-40 h-40 mb-4" />
        <h1 className="text-center text-4xl font-extrabold text-white mb-2">World Connect</h1>
        <p className="text-center text-lg text-blue-200 mb-8">Global Video Chat</p>
      </div>
      <div className="w-full max-w-md bg-card rounded-xl shadow-2xl p-8">
        {children}
      </div>
    </div>
  );
};

const MainLayout = ({ children, user, isAdmin, adminData }: {
  children: React.ReactNode,
  user: any,
  isAdmin: boolean,
  adminData: AdminData | null
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = location.pathname.split('/')[1] || 'videoChat';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1E293B] text-white">
      <nav className="bg-[#1E3A8A] bg-opacity-80 backdrop-blur-lg px-6 py-4 shadow-lg border-b border-blue-900">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <img src={logo} alt="World Connect Logo" className="h-10 w-10 mr-3" />
            <h1 className="text-xl font-bold text-gradient">World Connect</h1>
            {isAdmin && (
              <span className="ml-2 bg-yellow-500 text-xs font-semibold text-black px-2 py-1 rounded-full">
                {adminData?.role === 'superadmin' ? 'SUPER ADMIN' : 'ADMIN'}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/videoChat')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 ${currentPage === 'videoChat'
                ? 'bg-[#3B82F6] text-white shadow-md'
                : 'bg-transparent hover:bg-blue-800 hover:bg-opacity-30'}`}
            >
              Video Chat
            </button>
            <button
              onClick={() => navigate('/profile')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 ${currentPage === 'profile'
                ? 'bg-[#3B82F6] text-white shadow-md'
                : 'bg-transparent hover:bg-blue-800 hover:bg-opacity-30'}`}
            >
              Profile
            </button>
            {/* Only show Admin tab for admins */}
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${currentPage === 'admin'
                  ? 'bg-[#3B82F6] text-white shadow-md'
                  : 'bg-transparent hover:bg-blue-800 hover:bg-opacity-30'}`}
              >
                Admin Dashboard
              </button>
            )}
            <button
              onClick={() => auth.signOut()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-all duration-200 shadow-md"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto mt-8 px-4 pb-12">
        {children}
      </div>
    </div>
  );
};

// Authentication guard for protected routes
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-gradient flex items-center justify-center">
        <LoadingSpinner size={64} className="mx-auto" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserData | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        console.log('User is signed in:', user.email);
        setUser(user);

        // Load user profile from Firestore
        const profile = await getUserById(user.uid);
        setUserProfile(profile);

        // Check if user is an admin - try with both email and username (if available)
        if (user.email) {
          let adminResult: AdminData | null = null;

          if (profile && profile.username) {
            // Try with username first if available
            adminResult = await checkIsAdmin(user.uid, profile.username);
          }

          // If not found with username, try with email
          if (!adminResult && user.email) {
            adminResult = await checkIsAdmin(user.uid, user.email);
          }

          setIsAdmin(!!adminResult);
          setAdminData(adminResult);
          console.log('Admin check result:', adminResult);
        }
      } else {
        console.log('User is signed out');
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
        setAdminData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle registration success message
  const handleRegistrationSuccess = (message: string) => {
    setRegistrationSuccess(message);
  };

  // Clear registration message when navigating away from login page
  useEffect(() => {
    return () => {
      if (registrationSuccess) {
        setRegistrationSuccess('');
      }
    };
  }, [registrationSuccess]);

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-gradient flex flex-col items-center justify-center p-4">
        <img src={logo} alt="World Connect Logo" className="App-logo w-40 h-40 mb-8" />
        <LoadingSpinner size={48} className="mb-4" />
        <p className="text-white text-lg">Loading World Connect...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Auth routes (accessible when logged out) */}
        <Route path="/login" element={
          user ? <Navigate to="/videoChat" replace /> : (
            <AuthLayout>
              <Login
                registrationMessage={registrationSuccess}
              />
            </AuthLayout>
          )
        } />

        <Route path="/signup" element={
          user ? <Navigate to="/videoChat" replace /> : (
            <AuthLayout>
              <Register onRegisterSuccess={handleRegistrationSuccess} />
            </AuthLayout>
          )
        } />

        {/* Protected routes (require authentication) */}
        <Route path="/videoChat" element={
          <RequireAuth>
            <MainLayout user={user} isAdmin={isAdmin} adminData={adminData}>
              <VideoChat user={user} userProfile={userProfile} />
            </MainLayout>
          </RequireAuth>
        } />

        <Route path="/profile" element={
          <RequireAuth>
            <MainLayout user={user} isAdmin={isAdmin} adminData={adminData}>
              <Profile user={user} />
            </MainLayout>
          </RequireAuth>
        } />

        <Route path="/admin" element={
          <RequireAuth>
            <MainLayout user={user} isAdmin={isAdmin} adminData={adminData}>
              {isAdmin ? <AdminDashboard user={user} /> : <Navigate to="/videoChat" replace />}
            </MainLayout>
          </RequireAuth>
        } />

        {/* Redirect root to appropriate route based on auth status */}
        <Route path="/" element={
          user ? <Navigate to="/videoChat" replace /> : <Navigate to="/login" replace />
        } />

        {/* Catch all other routes */}
        <Route path="*" element={
          user ? <Navigate to="/videoChat" replace /> : <Navigate to="/login" replace />
        } />
      </Routes>
    </Router>
  );
};

export default App;
