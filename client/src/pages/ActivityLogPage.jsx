// client/src/pages/ActivityLogPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const ActivityLogPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchLogs = async () => {
            if (!auth.currentUser) {
                setLoading(false);
                return;
            }
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await fetch('{apiUrl}/api/activity-logs', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Could not fetch activity logs.');
                const data = await response.json();
                setLogs(data.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    // --- NEW: Helper function to make actions look nice ---
    const getActionStyle = (actionType) => {
        switch (actionType) {
            case 'CREATE_SALE':
            case 'CREATE_EXPENSE':
            case 'CREATE_USER':
                return { text: 'Create', className: 'text-green-400' };
            case 'UPDATE_TRANSACTION':
                return { text: 'Update', className: 'text-yellow-400' };
            case 'ADMIN_DELETE_TRANSACTION':
            case 'APPROVE_DELETION':
            case 'DISABLE_USER':
                return { text: 'Delete / Disable', className: 'text-red-500' };
            case 'REJECT_DELETION':
            case 'REQUEST_DELETION':
                return { text: 'Review', className: 'text-blue-400' };
            case 'PROMOTE_ADMIN':
                 return { text: 'Promotion', className: 'text-purple-400' };
            default:
                return { text: actionType.replace('_', ' '), className: 'text-white' };
        }
    };

    if (loading) return <p className="text-center text-gray-300">Loading activity log...</p>;
    if (error) return <p className="text-center text-red-500">Error: {error}</p>;

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Activity Log</h2>
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">Timestamp</th>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">User</th>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">Action</th>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="text-center p-8 text-gray-400">
                                        No activity has been logged yet.
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => {
                                    // Get the styled text and class for the action
                                    const actionStyle = getActionStyle(log.action_type);
                                    return (
                                        <tr key={log.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                                            <td className="p-4 text-gray-300 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="p-4 text-gray-300 whitespace-nowrap">{log.user_email}</td>
                                            {/* --- UPDATED: Use the styled action --- */}
                                            <td className={`p-4 font-mono font-bold ${actionStyle.className}`}>{actionStyle.text}</td>
                                            {/* Removed whitespace-nowrap from details to allow wrapping */}
                                            <td className="p-4 text-gray-300">{log.details}</td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ActivityLogPage;