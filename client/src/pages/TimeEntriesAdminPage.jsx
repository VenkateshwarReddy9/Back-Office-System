// client/src/pages/TimeEntriesAdminPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { format, addDays, subDays, startOfWeek } from 'date-fns';

const TimeEntriesAdminPage = () => {
    const [weekStartDate, setWeekStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [timeEntries, setTimeEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchTimeEntries = async (startDate) => {
            if (!auth.currentUser) return;
            setLoading(true);

            const endDate = addDays(startDate, 6);
            const token = await auth.currentUser.getIdToken();
            const headers = { 'Authorization': `Bearer ${token}` };
            
            try {
                const response = await fetch(`{apiUrl}/api/time-entries?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`, { headers });
                if (!response.ok) throw new Error('Could not fetch time entries.');
                const data = await response.json();
                setTimeEntries(data.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTimeEntries(weekStartDate);
    }, [weekStartDate]);

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-4 text-center">Weekly Time Entries</h2>

            <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg mb-6">
                <button onClick={() => setWeekStartDate(subDays(weekStartDate, 7))} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">Previous Week</button>
                <h3 className="text-xl text-white font-semibold">{format(weekStartDate, 'do MMMM yyyy')} - {format(addDays(weekStartDate, 6), 'do MMMM yyyy')}</h3>
                <button onClick={() => setWeekStartDate(addDays(weekStartDate, 7))} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">Next Week</button>
            </div>

            {error && <p className="text-red-500 text-center mb-4">{error}</p>}

            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="p-4 font-bold uppercase text-gray-400">Employee</th>
                                <th className="p-4 font-bold uppercase text-gray-400">Clock In</th>
                                <th className="p-4 font-bold uppercase text-gray-400">Clock Out</th>
                                <th className="p-4 font-bold uppercase text-gray-400">Hours Worked</th>
                                <th className="p-4 font-bold uppercase text-gray-400">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="text-center p-8 text-gray-400">Loading Entries...</td></tr>
                            ) : timeEntries.map(entry => (
                                <tr key={entry.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                    <td className="p-4 text-white font-semibold">{entry.full_name || entry.email}</td>
                                    <td className="p-4 text-gray-300">{new Date(entry.clock_in_timestamp).toLocaleString()}</td>
                                    <td className="p-4 text-gray-300">{entry.clock_out_timestamp ? new Date(entry.clock_out_timestamp).toLocaleString() : 'Still Clocked In'}</td>
                                    <td className="p-4 text-white font-bold">{entry.actual_hours_worked ? parseFloat(entry.actual_hours_worked).toFixed(2) : '-'}</td>
                                    <td className="p-4 text-gray-300">{entry.is_approved ? 'Approved' : 'Needs Review'}</td>
                                </tr>
                            ))}
                            {!loading && timeEntries.length === 0 && (
                                <tr><td colSpan="5" className="text-center p-8 text-gray-400">No time entries found for this period.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TimeEntriesAdminPage;