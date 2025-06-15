// client/src/pages/AvailabilityRequestsPage.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const AvailabilityRequestsPage = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchPendingRequests = async () => {
        if (!auth.currentUser) return;
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch('http://localhost:5000/api/availability/pending', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch pending requests.');
            const data = await response.json();
            setRequests(data.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingRequests();
    }, []);

    const handleAction = async (requestId, action) => {
        const confirmText = action === 'approve'
            ? "Are you sure you want to approve this time-off request?"
            : "Are you sure you want to reject this request?";
        
        if (!window.confirm(confirmText)) return;

        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch(`http://localhost:5000/api/availability/${requestId}/${action}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                // On success, remove the item from the list in the UI
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                const data = await response.json();
                alert(`Action failed: ${data.error}`);
            }
        } catch (err) {
            alert('An error occurred.');
        }
    };

    if (loading) return <p className="text-center text-gray-300">Loading requests...</p>;

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Pending Time Off Requests</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-4xl mx-auto">
                {error && <p className="text-red-500 text-center">{error}</p>}
                {requests.length === 0 ? (
                    <p className="text-gray-400 text-center">There are no pending requests.</p>
                ) : (
                    <ul className="space-y-4">
                        {requests.map(req => (
                            <li key={req.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-white">{req.full_name || req.email}</p>
                                    <p className="text-sm text-gray-300">{req.reason || 'No reason provided'}</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {new Date(req.start_time).toLocaleString()} to {new Date(req.end_time).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex space-x-3">
                                    <button onClick={() => handleAction(req.id, 'approve')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-4 rounded-md">Approve</button>
                                    <button onClick={() => handleAction(req.id, 'reject')} className="bg-red-800 hover:bg-red-700 text-white font-bold py-1 px-4 rounded-md">Reject</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default AvailabilityRequestsPage;