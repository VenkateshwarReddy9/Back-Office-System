// client/src/components/AddSaleForm.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const AddSaleForm = ({ onNewSale, transactionToEdit, onUpdate, onCancelEdit }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Dine-In'); 
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    // --- NEW: State for the mandatory edit reason ---
    const [editReason, setEditReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const saleCategories = ['Dine-In', 'Takeout', 'Delivery App', 'Beverages', 'Other'];
    const isEditMode = Boolean(transactionToEdit);

    useEffect(() => {
        if (isEditMode) {
            setDescription(transactionToEdit.description);
            setAmount(parseFloat(transactionToEdit.amount));
            setCategory(transactionToEdit.category || 'Other');
            setTransactionDate(new Date(transactionToEdit.transaction_date).toISOString().split('T')[0]);
        }
    }, [transactionToEdit, isEditMode]);

    const handleCancel = () => {
        onCancelEdit();
        setDescription('');
        setAmount('');
        setCategory('Dine-In');
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setEditReason(''); // Also reset the reason field
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user || !description || !amount) return;
        
        // --- NEW: Add validation for the reason in edit mode ---
        if (isEditMode && !editReason.trim()) {
            alert("Please provide a reason for the edit.");
            return;
        }

        setIsSubmitting(true);

        const saleData = {
            description: description.trim(),
            amount: parseFloat(amount),
            transaction_date: transactionDate,
            type: 'sale',
            category: category,
            reason: editReason // <-- Send the reason
        };
        
        const endpoint = isEditMode ? `{apiUrl}/api/transactions/${transactionToEdit.id}` : '{apiUrl}/api/transactions';
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            const token = await user.getIdToken();
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(saleData)
            });

            const result = await response.json();
            if (response.ok) {
                if (isEditMode) onUpdate(result.data);
                else onNewSale(result.data);
                handleCancel();
            } else {
                alert(`Error: ${result.error || 'Action failed.'}`);
            }
        } catch (error) {
            alert('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-9">
    <h3 className="text-xl font-bold text-white mb-4">{isEditMode ? 'Edit Sale' : 'Add New Sale'}</h3>
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
        {/* Description Input */}
        <div className="md:col-span-3">
            <input 
                type="text" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Sale description" 
                required 
                disabled={isSubmitting} 
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50" 
            />
        </div>
        
        {/* Amount Input */}
        <div className="md:col-span-3">
            <input 
                type="number" 
                step="0.01" 
                min="0.01" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="Amount" 
                required 
                disabled={isSubmitting} 
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50" 
            />
        </div>
        
        {/* Date Input */}
        <div className="md:col-span-3">
            <input 
                type="date" 
                value={transactionDate} 
                onChange={(e) => setTransactionDate(e.target.value)} 
                required 
                disabled={isSubmitting} 
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50" 
            />
        </div>
        
        {/* Category Dropdown */}
        <div className="md:col-span-3">
            <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                disabled={isSubmitting} 
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
                {saleCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
            </select>
        </div>

        {/* Edit Reason Field - Only shows in edit mode */}
        {isEditMode && (
            <div className="md:col-span-6">
                <input 
                    type="text" 
                    value={editReason} 
                    onChange={(e) => setEditReason(e.target.value)} 
                    placeholder="Reason for Edit (Required)" 
                    required 
                    disabled={isSubmitting} 
                    className="w-full px-4 py-2 bg-yellow-900/50 border border-yellow-500 rounded-lg text-white placeholder-yellow-400/70 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50" 
                />
            </div>
        )}

        {/* Buttons */}
        <div className="md:col-span-6">
            <div className="flex justify-center space-x-4">
                {isEditMode && (
                    <button 
                        type="button" 
                        onClick={handleCancel} 
                        disabled={isSubmitting} 
                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                )}
                <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600 transition-colors"
                >
                    {isSubmitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Sale')}
                </button>
            </div>
        </div>
    </form>
</div>

    );
};

export default AddSaleForm;