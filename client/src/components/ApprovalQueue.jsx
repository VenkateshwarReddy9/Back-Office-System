// client/src/components/ApprovalQueue.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

// Now accepts an onActionComplete prop to refresh the parent dashboard
const ApprovalQueue = ({ onActionComplete }) => {
    const [requests, setRequests] = useState([]);

    const fetchRequests = async () => {
        if (!auth.currentUser) return;
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch('http://localhost:5000/api/approval-requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setRequests(data.data || []);
            } else {
                console.error("Failed to fetch approval requests:", data.error);
            }
        } catch (error) {
            console.error("Error fetching requests:", error);
        }
    };

    // We can add a dependency on the onActionComplete function itself
    // to subtly hint that it can be used to trigger a refresh,
    // though the primary trigger is the user's click action.
    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (transactionId, action) => {
        const confirmText = action === 'approve-delete' 
            ? "Are you sure you want to approve this deletion? The transaction will be permanently removed."
            : "Are you sure you want to reject this deletion request?";
        
        if (!window.confirm(confirmText)) return;

        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`http://localhost:5000/api/transactions/${transactionId}/${action}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            // SUCCESS: Instead of managing its own state,
            // it now tells the parent Dashboard to refresh all data.
            onActionComplete();
        } else {
            alert('Action failed. Please try again.');
        }
    };

    if (requests.length === 0) {
        return null; 
    }

    return (
        <div className="bg-yellow-900/20 border-2 border-yellow-500 p-6 rounded-lg shadow-lg mb-8">
            <h3 className="text-xl font-bold text-yellow-300 mb-4">Pending Deletion Requests</h3>
            <ul className="space-y-3">
                {requests.map(req => (
                    <li key={req.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-white">{req.description} - £{parseFloat(req.amount).toFixed(2)}</p>
                            <p className="text-sm text-gray-400">
                                Requested by: <span className="font-medium">{req.user_email}</span>
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button onClick={() => handleAction(req.id, 'approve-delete')} className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-1 px-3 rounded-md transition-colors">
                                Approve
                            </button>
                            <button onClick={() => handleAction(req.id, 'reject-delete')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold text-xs py-1 px-3 rounded-md transition-colors">
                                Reject
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ApprovalQueue;