// client/src/pages/LaborReportPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { format } from 'date-fns';

const LaborReportPage = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReport = async (date) => {
            if (!auth.currentUser) return;
            setLoading(true);
            setError('');
            setReportData(null);

            const token = await auth.currentUser.getIdToken();
            try {
                const response = await fetch(`http://localhost:5000/api/reports/labor-vs-sales?date=${date}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch report data.');
                const data = await response.json();
                setReportData(data.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchReport(selectedDate);
    }, [selectedDate]);

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-4 text-center">Labor vs. Sales Report</h2>
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6 max-w-sm mx-auto flex items-center justify-center space-x-4">
                <label htmlFor="report-date-picker" className="font-bold text-white">Select Date:</label>
                <input
                    type="date"
                    id="report-date-picker"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-gray-700 text-white p-2 rounded-lg border border-gray-600"
                />
            </div>

            {loading && <p className="text-center text-gray-400">Generating Report...</p>}
            {error && <p className="text-center text-red-500">{error}</p>}
            
            {reportData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                        <h3 className="text-green-400 text-sm font-bold uppercase tracking-wider">Total Sales</h3>
                        <p className="text-4xl font-bold text-white mt-2">£{reportData.totalSales.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                        <h3 className="text-red-400 text-sm font-bold uppercase tracking-wider">Projected Labor Cost</h3>
                        <p className="text-4xl font-bold text-white mt-2">£{reportData.totalLaborCost.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                        <h3 className="text-yellow-400 text-sm font-bold uppercase tracking-wider">Labor Cost % of Sales</h3>
                        <p className="text-4xl font-bold text-white mt-2">{reportData.laborCostPercentage.toFixed(1)}%</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LaborReportPage;