// client/src/pages/EmployeesPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../firebase';

const EmployeesPage = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchEmployees = async () => {
            if (!auth.currentUser) {
                setLoading(false);
                return;
            }
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await fetch('http://localhost:5000/api/employees', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error('Could not fetch employee data. Please ensure you are logged in as an admin.');
                }
                const data = await response.json();
                setEmployees(data.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchEmployees();
    }, []);

    if (loading) return <p className="text-center text-gray-300">Loading employees...</p>;
    if (error) return <p className="text-center text-red-500">Error: {error}</p>;

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Employee Profiles</h2>
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">Full Name</th>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">Email</th>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">Job Role</th>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">Pay Rate (£/hr)</th>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">Status</th>
                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center p-8 text-gray-400">
                                        No employees found. You can create users in the 'User Access' page.
                                    </td>
                                </tr>
                            ) : (
                                employees.map(emp => (
                                    <tr key={emp.uid} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                                        <td className="p-4 text-white font-semibold">{emp.full_name || <span className="text-gray-500">Not Set</span>}</td>
                                        <td className="p-4 text-gray-300">{emp.email}</td>
                                        <td className="p-4 text-gray-300">{emp.job_role || <span className="text-gray-500">Not Set</span>}</td>
                                        <td className="p-4 text-gray-300">£{parseFloat(emp.pay_rate || 0).toFixed(2)}</td>
                                        <td className="p-4 text-gray-300">{emp.status}</td>
                                        <td className="p-4">
                                            {/* This link will take us to the edit page we will build next */}
                                            <Link to={`/employees/${emp.uid}/edit`} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors">
                                                Edit
                                            </Link>
                                        </td>
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

export default EmployeesPage;