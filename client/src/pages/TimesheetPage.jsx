// client/src/pages/TimesheetPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { format, subDays, startOfWeek } from 'date-fns';

const TimesheetPage = () => {
    // Default to showing the report for the last 7 days
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(subDays(new Date(), 6));
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchTimesheetReport = async (start, end) => {
        if (!auth.currentUser) return;
        setLoading(true);
        const token = await auth.currentUser.getIdToken();
        const headers = { 'Authorization': `Bearer ${token}` };
        
        const startDateStr = format(start, 'yyyy-MM-dd');
        const endDateStr = format(end, 'yyyy-MM-dd');

        try {
            const response = await fetch(`{apiUrl}/api/reports/timesheet?start_date=${startDateStr}&end_date=${endDateStr}`, { headers });
            if (!response.ok) throw new Error('Failed to fetch timesheet report.');
            const data = await response.json();
            setReportData(data.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimesheetReport(startDate, endDate);
    }, [startDate, endDate]);

    const handleExport = () => {
        const startDateStr = format(startDate, 'yyyy-MM-dd');
        const endDateStr = format(endDate, 'yyyy-MM-dd');
        // This opens the CSV download link in a new tab.
        // We need to get the token again for the authenticated download link.
        auth.currentUser.getIdToken().then(token => {
            const exportUrl = `{apiUrl}/api/reports/timesheet/export?start_date=${startDateStr}&end_date=${endDateStr}&token=${token}`;
            window.open(exportUrl, '_blank');
        });
    };
    
    // We need to slightly modify the backend to accept the token via query param for this download link to work easily
    // This is a common pattern for authenticated file downloads.

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-4 text-center">Timesheet & Payroll Summary</h2>
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6 flex items-center justify-center space-x-4">
                <div>
                    <label className="text-white text-sm">Start Date:</label>
                    <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={e => setStartDate(new Date(e.target.value))} className="bg-gray-700 text-white p-2 rounded-lg border border-gray-600 ml-2" />
                </div>
                <div>
                    <label className="text-white text-sm">End Date:</label>
                    <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={e => setEndDate(new Date(e.target.value))} className="bg-gray-700 text-white p-2 rounded-lg border border-gray-600 ml-2" />
                </div>
                <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Export as CSV</button>
            </div>

            {error && <p className="text-red-500 text-center mb-4">{error}</p>}

            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="p-4 font-bold uppercase text-gray-400">Employee</th>
                                <th className="p-4 font-bold uppercase text-gray-400">Email</th>
                                <th className="p-4 font-bold uppercase text-gray-400">Pay Rate (£/hr)</th>
                                <th className="p-4 font-bold uppercase text-gray-400">Total Hours</th>
                                <th className="p-4 font-bold uppercase text-gray-400">Total Pay</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="text-center p-8 text-gray-400">Loading Report...</td></tr>
                            ) : reportData.map(row => (
                                <tr key={row.uid} className="border-b border-gray-700">
                                    <td className="p-4 text-white font-semibold">{row.full_name || 'N/A'}</td>
                                    <td className="p-4 text-gray-300">{row.email}</td>
                                    <td className="p-4 text-gray-300">£{parseFloat(row.pay_rate).toFixed(2)}</td>
                                    <td className="p-4 text-white font-bold">{parseFloat(row.total_hours).toFixed(2)}</td>
                                    <td className="p-4 text-green-400 font-bold">£{parseFloat(row.total_pay).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TimesheetPage;