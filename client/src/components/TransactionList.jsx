// client/src/components/TransactionList.jsx

import React from 'react';
import { auth } from '../firebase';

// Now accepts onEdit and onActionComplete to communicate with the Dashboard
const TransactionList = ({ transactions, userProfile, onEdit, onActionComplete }) => {

    const handleRequestDelete = async (transactionId) => {
        if (!window.confirm("Are you sure you want to request deletion for this item?")) return;
        
        const user = auth.currentUser;
        if (!user) return;

        try {
            const token = await user.getIdToken();
            const response = await fetch(`http://localhost:5000/api/transactions/${transactionId}/request-delete`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                alert("Success: " + data.message);
                onActionComplete(); // Tell the dashboard to refresh its data
            } else {
                alert("Error: " + (data.error || "Could not submit request."));
            }
        } catch (error) {
            alert("An error occurred while submitting the request.");
        }
    };

    const handleAdminDelete = async (transactionId) => {
        if (!window.confirm("ADMIN ACTION: Are you sure you want to permanently delete this transaction? This cannot be undone.")) return;
        
        const user = auth.currentUser;
        if (!user) return;

        try {
            const token = await user.getIdToken();
            const response = await fetch(`http://localhost:5000/api/transactions/${transactionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                onActionComplete(); // Tell the dashboard to refresh its data
            } else {
                alert("Error: " + (data.error || "Could not delete transaction."));
            }
        } catch (error) {
            alert("An error occurred while deleting.");
        }
    };

    if (!transactions || transactions.length === 0) {
        return (
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-xl font-bold text-white">Your Expenses</h3>
                <p className="text-gray-400 mt-2">No expenses recorded for this day.</p>
            </div>
        );
    }

    const isAdmin = userProfile.role === 'primary_admin' || userProfile.role === 'secondary_admin';

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">Your Expenses</h3>
            <ul className="space-y-3">
                {transactions.map(t => (
                    <li key={t.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center transition-all duration-200">
                        {/* Left side: Description and Metadata */}
                        <div>
                            <span className="font-semibold text-white">{t.description}</span>
                            <span className="text-sm text-gray-400 block">
                                {new Date(t.transaction_date).toLocaleString()}
                                {isAdmin && t.user_email && <span className="ml-2 font-medium">(Added by: {t.user_email})</span>}
                            </span>
                        </div>
                        
                        {/* Right side: Amount and Actions */}
                        <div className="flex items-center space-x-4">
                            <span className="text-2xl font-bold text-white">£{parseFloat(t.amount).toFixed(2)}</span>
                            
                            <div className="flex items-center justify-end space-x-2 w-48">
                                {t.status === 'pending_delete' && (
                                    <span className="text-yellow-400 font-semibold text-sm">Pending Deletion</span>
                                )}

                                {t.status === 'approved' && (
                                    isAdmin ? (
                                        <>
                                            <button onClick={() => onEdit(t)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors">
                                                Edit
                                            </button>
                                            <button onClick={() => handleAdminDelete(t.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors">
                                                Delete
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => handleRequestDelete(t.id)} className="bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors">
                                            Request Deletion
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default TransactionList;