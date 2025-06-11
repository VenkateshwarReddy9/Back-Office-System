// client/src/pages/UserManagementPage.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const UserManagementPage = ({ userProfile }) => {
    const [users, setUsers] = useState([]);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('staff');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            if (!auth.currentUser) return;
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('http://localhost:5000/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setUsers(data.data);
            } else {
                setError(data.error || 'Failed to fetch users.');
            }
        };
        fetchUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('http://localhost:5000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ email, password, role })
        });
        const data = await response.json();
        if (response.ok) {
            setMessage(data.message);
            setUsers([...users, data.data]);
            setEmail('');
            setPassword('');
        } else {
            setError(data.error || 'Failed to create user.');
        }
    };

    const handleDisableUser = async (userToDisable) => {
        if (!window.confirm(`Are you sure you want to disable the user: ${userToDisable.email}? They will no longer be able to log in.`)) return;
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`http://localhost:5000/api/users/${userToDisable.uid}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                setUsers(prevUsers => prevUsers.map(u => 
                    u.uid === userToDisable.uid ? { ...u, status: 'inactive' } : u
                ));
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('An unexpected error occurred.');
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-8 text-center">User Management</h2>

            {/* Create New User Card */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Create New User</h3>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="New User Email" required className="sm:col-span-2 md:col-span-1 w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New User Password" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                    <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                        <option value="staff">Staff</option>
                        <option value="secondary_admin">Secondary Admin</option>
                    </select>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">Create User</button>
                </form>
                {message && <p className="text-green-400 mt-4">{message}</p>}
                {error && <p className="text-red-500 mt-4">{error}</p>}
            </div>

            {/* Existing Users Card */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Existing Users</h3>
                <ul className="space-y-3">
                    {users.map(user => (
                        <li key={user.uid} className={`bg-gray-700 p-3 rounded-lg flex justify-between items-center transition-opacity ${user.status === 'inactive' ? 'opacity-60' : ''}`}>
                            <span className={`font-mono ${user.status === 'inactive' ? 'text-gray-400' : 'text-white'}`}>
                                {user.email} - ({user.role}) - [Status: {user.status}]
                            </span>
                            
                            {userProfile.uid !== user.uid && user.status === 'active' && (
                                <button onClick={() => handleDisableUser(user)} className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors duration-200">
                                    Disable
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default UserManagementPage;