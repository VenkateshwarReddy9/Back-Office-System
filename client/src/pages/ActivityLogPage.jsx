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
                const response = await fetch('http://localhost:5000/api/activity-logs', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error('Could not fetch activity logs.');
                }
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

    if (loading) {
        return <p className="text-center text-gray-300">Loading activity log...</p>;
    }

    if (error) {
        return <p className="text-center text-red-500">Error: {error}</p>;
    }

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
                                logs.map(log => (
                                    <tr key={log.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                                        <td className="p-4 text-gray-300 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="p-4 text-gray-300 whitespace-nowrap">{log.user_email}</td>
                                        <td className="p-4 text-white font-mono">{log.action_type}</td>
                                        <td className="p-4 text-gray-300">{log.details}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ActivityLogPage;