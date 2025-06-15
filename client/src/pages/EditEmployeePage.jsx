// client/src/pages/EditEmployeePage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

const EditEmployeePage = () => {
    // Hooks to get URL parameters and to navigate programmatically
    const { uid } = useParams();
    const navigate = useNavigate();

    // State to hold the form data
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch the specific employee's data when the page loads
    useEffect(() => {
        const fetchEmployee = async () => {
            const token = await auth.currentUser.getIdToken();
            try {
                const response = await fetch(`{apiUrl}/api/employees/${uid}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch employee data.');
                const data = await response.json();
                setEmployee(data.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (auth.currentUser) {
            fetchEmployee();
        }
    }, [uid]); // Re-run if the UID in the URL changes

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEmployee(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch(`{apiUrl}/api/employees/${uid}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fullName: employee.full_name,
                    phoneNumber: employee.phone_number,
                    jobRole: employee.job_role,
                    payRate: employee.pay_rate,
                    role: employee.role,
                    status: employee.status,
                })
            });
            if (!response.ok) throw new Error('Failed to update profile.');
            alert('Employee profile updated successfully!');
            navigate('/employees'); // Navigate back to the employee list on success
        } catch (err) {
            setError(err.message);
            alert(`Error: ${err.message}`);
        }
    };

    if (loading) return <p className="text-center text-gray-300">Loading employee profile...</p>;
    if (error) return <p className="text-center text-red-500">Error: {error}</p>;
    if (!employee) return <p className="text-center text-gray-300">Employee not found.</p>;

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Edit Profile for {employee.email}</h2>
            <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-lg shadow-lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="full_name" className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                        <input id="full_name" name="full_name" type="text" value={employee.full_name || ''} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                    </div>
                    <div>
                        <label htmlFor="phone_number" className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
                        <input id="phone_number" name="phone_number" type="tel" value={employee.phone_number || ''} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                    </div>
                    <div>
                        <label htmlFor="job_role" className="block text-sm font-medium text-gray-300 mb-1">Job Role</label>
                        <input id="job_role" name="job_role" type="text" value={employee.job_role || ''} onChange={handleInputChange} placeholder="e.g., Cook, Cashier" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                    </div>
                     <div>
                        <label htmlFor="pay_rate" className="block text-sm font-medium text-gray-300 mb-1">Pay Rate (£/hr)</label>
                        <input id="pay_rate" name="pay_rate" type="number" step="0.01" min="0" value={employee.pay_rate || ''} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                    </div>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={() => navigate('/employees')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Cancel</button>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditEmployeePage;