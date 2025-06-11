// client/src/components/AddExpenseForm.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const AddExpenseForm = ({ onNewExpense, transactionToEdit, onUpdate, onCancelEdit }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

    const isEditMode = Boolean(transactionToEdit);

    useEffect(() => {
        if (isEditMode) {
            setDescription(transactionToEdit.description);
            setAmount(transactionToEdit.amount);
            setTransactionDate(new Date(transactionToEdit.transaction_date).toISOString().split('T')[0]);
        }
    }, [transactionToEdit, isEditMode]);

    const handleCancel = () => {
        onCancelEdit();
        setDescription('');
        setAmount('');
        setTransactionDate(new Date().toISOString().split('T')[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdToken();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        const body = JSON.stringify({
            description,
            amount: parseFloat(amount),
            transaction_date: transactionDate
        });

        const endpoint = isEditMode
            ? `http://localhost:5000/api/transactions/${transactionToEdit.id}`
            : 'http://localhost:5000/api/transactions';
        const method = isEditMode ? 'PUT' : 'POST';

        const response = await fetch(endpoint, { method, headers, body });

        if (response.ok) {
            const result = await response.json();
            if (isEditMode) {
                onUpdate(result.data);
            } else {
                onNewExpense(result.data);
            }
            handleCancel();
        } else {
            alert("Error: Action failed.");
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
            <h3 className="text-xl font-bold text-white mb-4">
                {isEditMode ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                <div className="md:col-span-2">
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Expense description"
                        required
                        className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="md:col-span-2">
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Amount"
                        required
                        className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="md:col-span-1">
                    <input
                        type="date"
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        required
                        className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="md:col-span-1 flex space-x-2">
                    <button
                        type="submit"
                        className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                        {isEditMode ? 'Save Changes' : 'Add Expense'}
                    </button>
                    {isEditMode && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="w-full px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default AddExpenseForm;
