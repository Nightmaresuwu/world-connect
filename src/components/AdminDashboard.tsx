import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { getAllUsers, UserData, setAllUsersOnline } from '../lib/userService';
import { getAllAdmins, AdminData } from '../lib/adminService';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AdminDashboardProps {
    user: User;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [admins, setAdmins] = useState<AdminData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshInterval, setRefreshInterval] = useState<number>(30); // seconds
    const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<'users' | 'admins'>('users');

    // Admin add form state
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminRole, setNewAdminRole] = useState<'admin' | 'superadmin'>('admin');
    const [addingAdmin, setAddingAdmin] = useState(false);

    // Function to load all users
    const loadUsers = async () => {
        try {
            setLoading(true);
            const allUsers = await getAllUsers();
            setUsers(allUsers);
            setError(null);
        } catch (err) {
            console.error('Error loading users:', err);
            setError('Failed to load users. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Function to load all admins
    const loadAdmins = async () => {
        try {
            const allAdmins = await getAllAdmins();
            setAdmins(allAdmins);
        } catch (err) {
            console.error('Error loading admins:', err);
            setError('Failed to load admins. Please try again.');
        }
    };

    // Initial load and refresh setup
    useEffect(() => {
        loadUsers();
        loadAdmins();

        // Setup auto-refresh if enabled
        let intervalId: NodeJS.Timeout;
        if (autoRefresh) {
            intervalId = setInterval(() => {
                loadUsers();
                if (activeTab === 'admins') {
                    loadAdmins();
                }
            }, refreshInterval * 1000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [autoRefresh, refreshInterval, activeTab]);

    // Make all users online for testing
    const handleSetAllUsersOnline = async () => {
        try {
            setLoading(true);
            await setAllUsersOnline();
            await loadUsers();
            setError('All users have been set as online for testing');
            setTimeout(() => setError(null), 3000);
        } catch (err) {
            console.error('Error setting all users online:', err);
            setError('Failed to set all users online');
        } finally {
            setLoading(false);
        }
    };

    // Add a new admin
    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAdminEmail) {
            setError('Please enter an email address');
            return;
        }

        try {
            setAddingAdmin(true);
            const adminId = newAdminEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');

            await setDoc(doc(db, 'admins', adminId), {
                email: newAdminEmail.toLowerCase(),
                role: newAdminRole,
                createdAt: serverTimestamp(),
                addedBy: user.uid
            });

            setNewAdminEmail('');
            loadAdmins();
            setError(`Admin ${newAdminEmail} has been added successfully`);
            setTimeout(() => setError(null), 3000);
        } catch (err) {
            console.error('Error adding admin:', err);
            setError('Failed to add admin. Please try again.');
        } finally {
            setAddingAdmin(false);
        }
    };

    // Remove an admin
    const handleRemoveAdmin = async (adminId: string) => {
        if (!window.confirm('Are you sure you want to remove this admin?')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'admins', adminId));
            loadAdmins();
            setError('Admin has been removed successfully');
            setTimeout(() => setError(null), 3000);
        } catch (err) {
            console.error('Error removing admin:', err);
            setError('Failed to remove admin. Please try again.');
        }
    };

    // Get online users count
    const onlineUsersCount = users.filter(u => u.isOnline).length;

    // Sort users: online first, then alphabetically by username/email
    const sortedUsers = [...users].sort((a, b) => {
        // First sort by online status
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;

        // Then sort by username/email
        const aName = a.username || a.email || '';
        const bName = b.username || b.email || '';
        return aName.localeCompare(bName);
    });

    return (
        <div className="bg-gray-800 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Admin Dashboard</h2>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <span className="mr-2">Auto-refresh:</span>
                        <label className="inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={() => setAutoRefresh(!autoRefresh)}
                                className="sr-only peer"
                            />
                            <div className="relative w-11 h-6 bg-gray-600 peer-checked:bg-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                    </div>
                    {autoRefresh && (
                        <div className="flex items-center">
                            <span className="mr-2">Refresh every:</span>
                            <select
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                className="bg-gray-700 text-white rounded p-1"
                            >
                                <option value={5}>5 seconds</option>
                                <option value={10}>10 seconds</option>
                                <option value={30}>30 seconds</option>
                                <option value={60}>1 minute</option>
                            </select>
                        </div>
                    )}
                    <button
                        onClick={() => {
                            loadUsers();
                            loadAdmins();
                        }}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-60"
                    >
                        {loading ? 'Refreshing...' : 'Refresh Now'}
                    </button>
                    <button
                        onClick={handleSetAllUsersOnline}
                        disabled={loading}
                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition disabled:opacity-60"
                    >
                        Set All Online
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500 text-white p-3 rounded mb-4">
                    {error}
                    <button
                        onClick={() => setError(null)}
                        className="ml-2 font-bold"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="mb-6 border-b border-gray-700">
                <div className="flex">
                    <button
                        className={`py-2 px-4 ${activeTab === 'users' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-400 hover:text-white'}`}
                        onClick={() => setActiveTab('users')}
                    >
                        Manage Users
                    </button>
                    <button
                        className={`py-2 px-4 ${activeTab === 'admins' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-400 hover:text-white'}`}
                        onClick={() => setActiveTab('admins')}
                    >
                        Manage Admins
                    </button>
                </div>
            </div>

            {activeTab === 'users' ? (
                <>
                    <div className="mb-6">
                        <div className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-semibold">User Statistics</h3>
                                <p className="text-gray-300 mt-1">Total users: {users.length}</p>
                            </div>
                            <div className="flex items-center">
                                <div className="h-4 w-4 bg-green-500 rounded-full mr-2"></div>
                                <span className="text-xl font-semibold">{onlineUsersCount} Online</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">User List</h3>
                            <div className="text-sm text-gray-300">
                                Showing {users.length} users ({onlineUsersCount} online)
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-gray-800 rounded-lg">
                                <thead>
                                    <tr className="bg-gray-900 text-left">
                                        <th className="py-3 px-4 text-white">Status</th>
                                        <th className="py-3 px-4 text-white">User ID</th>
                                        <th className="py-3 px-4 text-white">Email</th>
                                        <th className="py-3 px-4 text-white">Username</th>
                                        <th className="py-3 px-4 text-white">Gender</th>
                                        <th className="py-3 px-4 text-white">Last Active</th>
                                        <th className="py-3 px-4 text-white">Created At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && users.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-10 text-center text-gray-400">
                                                Loading users...
                                            </td>
                                        </tr>
                                    ) : sortedUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-10 text-center text-gray-400">
                                                No users found
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedUsers.map((userData) => (
                                            <tr key={userData.uid} className="border-t border-gray-700">
                                                <td className="py-3 px-4">
                                                    <div className={`h-3 w-3 rounded-full ${userData.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                                </td>
                                                <td className="py-3 px-4 text-gray-300 font-mono text-xs">{userData.uid.substring(0, 8)}...</td>
                                                <td className="py-3 px-4">{userData.email}</td>
                                                <td className="py-3 px-4">{userData.username || 'Not set'}</td>
                                                <td className="py-3 px-4">{userData.gender || 'Not set'}</td>
                                                <td className="py-3 px-4">
                                                    {userData.lastActive
                                                        ? new Date(userData.lastActive.toDate()).toLocaleString()
                                                        : 'Never'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {userData.createdAt
                                                        ? new Date(userData.createdAt.toDate()).toLocaleString()
                                                        : 'Unknown'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="mb-6">
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4">Add New Admin</h3>
                            <form onSubmit={handleAddAdmin} className="flex flex-wrap gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Admin Email
                                    </label>
                                    <input
                                        type="email"
                                        value={newAdminEmail}
                                        onChange={(e) => setNewAdminEmail(e.target.value)}
                                        placeholder="admin@example.com"
                                        required
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Role
                                    </label>
                                    <select
                                        value={newAdminRole}
                                        onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'superadmin')}
                                        className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="superadmin">Super Admin</option>
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={addingAdmin}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-60"
                                >
                                    {addingAdmin ? 'Adding...' : 'Add Admin'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="bg-gray-700 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">Admin List</h3>
                            <div className="text-sm text-gray-300">
                                Showing {admins.length} admins
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-gray-800 rounded-lg">
                                <thead>
                                    <tr className="bg-gray-900 text-left">
                                        <th className="py-3 px-4 text-white">Admin ID</th>
                                        <th className="py-3 px-4 text-white">Email</th>
                                        <th className="py-3 px-4 text-white">Role</th>
                                        <th className="py-3 px-4 text-white">Created At</th>
                                        <th className="py-3 px-4 text-white">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-10 text-center text-gray-400">
                                                No admins found
                                            </td>
                                        </tr>
                                    ) : (
                                        admins.map((adminData) => (
                                            <tr key={adminData.uid} className="border-t border-gray-700">
                                                <td className="py-3 px-4 text-gray-300 font-mono text-xs">{adminData.uid}</td>
                                                <td className="py-3 px-4">{adminData.email}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${adminData.role === 'superadmin' ? 'bg-purple-600' : 'bg-blue-600'
                                                        }`}>
                                                        {adminData.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {adminData.createdAt
                                                        ? new Date(adminData.createdAt.toDate()).toLocaleString()
                                                        : 'Unknown'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button
                                                        onClick={() => handleRemoveAdmin(adminData.uid)}
                                                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                                                    >
                                                        Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminDashboard; 