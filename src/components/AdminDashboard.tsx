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
    const [newAdminUsername, setNewAdminUsername] = useState('');
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

        if (!newAdminUsername) {
            setError('Please enter a username');
            return;
        }

        try {
            setAddingAdmin(true);
            const adminId = newAdminEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');

            await setDoc(doc(db, 'admins', adminId), {
                email: newAdminEmail.toLowerCase(),
                username: newAdminUsername,
                role: newAdminRole,
                createdAt: serverTimestamp(),
                addedBy: user.uid
            });

            setNewAdminEmail('');
            setNewAdminUsername('');
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
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

            {error && (
                <div className={`p-4 rounded mb-6 ${error.includes('successfully') ? 'bg-green-500' : 'bg-red-500'}`}>
                    {error}
                </div>
            )}

            <div className="mb-8">
                <div className="flex mb-4">
                    <button
                        className={`px-4 py-2 rounded-t-lg mr-2 ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        onClick={() => setActiveTab('users')}
                    >
                        Users
                    </button>
                    <button
                        className={`px-4 py-2 rounded-t-lg ${activeTab === 'admins' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        onClick={() => setActiveTab('admins')}
                    >
                        Admins
                    </button>
                </div>

                {activeTab === 'users' && (
                    <div className="bg-gray-800 p-6 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">
                                Users ({users.length}) - {onlineUsersCount} online
                            </h2>
                            <div className="flex items-center">
                                <button
                                    onClick={loadUsers}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-2"
                                >
                                    Refresh
                                </button>
                                <button
                                    onClick={() => setAllUsersOnline()}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                                >
                                    Set All Online
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-gray-700 rounded">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left">Username</th>
                                        <th className="px-4 py-2 text-left">Email</th>
                                        <th className="px-4 py-2 text-left">Status</th>
                                        <th className="px-4 py-2 text-left">Last Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                                            </td>
                                        </tr>
                                    ) : users.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-4 text-center">No users found</td>
                                        </tr>
                                    ) : (
                                        users.map(user => (
                                            <tr key={user.uid} className="border-t border-gray-600">
                                                <td className="px-4 py-2">{user.username || 'N/A'}</td>
                                                <td className="px-4 py-2">{user.email}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${user.isOnline ? 'bg-green-500' : 'bg-red-500'}`}>
                                                        {user.isOnline ? 'Online' : 'Offline'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {user.lastActive ? new Date(user.lastActive.toDate()).toLocaleString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'admins' && (
                    <div className="bg-gray-800 p-6 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">
                                Admins ({admins.length})
                            </h2>
                            <button
                                onClick={loadAdmins}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                            >
                                Refresh
                            </button>
                        </div>

                        <form onSubmit={handleAddAdmin} className="mb-6 bg-gray-700 p-4 rounded">
                            <h3 className="text-lg font-medium mb-4">Add New Admin</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="col-span-1 md:col-span-2">
                                    <input
                                        type="email"
                                        placeholder="Email Address"
                                        value={newAdminEmail}
                                        onChange={(e) => setNewAdminEmail(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-600 text-white rounded"
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        value={newAdminUsername}
                                        onChange={(e) => setNewAdminUsername(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-600 text-white rounded"
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <select
                                        value={newAdminRole}
                                        onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'superadmin')}
                                        className="w-full px-3 py-2 bg-gray-600 text-white rounded"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="superadmin">Super Admin</option>
                                    </select>
                                </div>
                                <div className="col-span-1 md:col-span-4">
                                    <button
                                        type="submit"
                                        disabled={addingAdmin}
                                        className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 text-white rounded disabled:opacity-50"
                                    >
                                        {addingAdmin ? 'Adding...' : 'Add Admin'}
                                    </button>
                                </div>
                            </div>
                        </form>

                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-gray-700 rounded">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left">Username</th>
                                        <th className="px-4 py-2 text-left">Email</th>
                                        <th className="px-4 py-2 text-left">Role</th>
                                        <th className="px-4 py-2 text-left">Created</th>
                                        <th className="px-4 py-2 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-4 text-center">No admins found</td>
                                        </tr>
                                    ) : (
                                        admins.map(admin => (
                                            <tr key={admin.uid} className="border-t border-gray-600">
                                                <td className="px-4 py-2">{admin.username || 'N/A'}</td>
                                                <td className="px-4 py-2">{admin.email}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${admin.role === 'superadmin' ? 'bg-yellow-500 text-black' : 'bg-blue-500'}`}>
                                                        {admin.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {admin.createdAt ? new Date(admin.createdAt.toDate()).toLocaleString() : 'N/A'}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <button
                                                        onClick={() => handleRemoveAdmin(admin.uid)}
                                                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
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
                )}
            </div>
        </div>
    );
};

export default AdminDashboard; 