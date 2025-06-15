// client/src/pages/MySchedulePage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { format, addDays, subDays, startOfWeek } from 'date-fns';

const MySchedulePage = () => {
    const [weekStartDate, setWeekStartDate] = useState(startOfWeek(new Date()));
    const [myShifts, setMyShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const user = auth.currentUser;

    useEffect(() => {
        const fetchMySchedule = async (startDate) => {
            if (!user) return;
            setLoading(true);

            const endDate = addDays(startDate, 6);
            const token = await user.getIdToken();
            const headers = { 'Authorization': `Bearer ${token}` };
            
            try {
                const response = await fetch(`{apiUrl}/api/my-schedule?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`, { headers });
                if (!response.ok) throw new Error('Could not fetch schedule.');
                const data = await response.json();
                setMyShifts(data.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMySchedule(weekStartDate);
    }, [weekStartDate, user]);

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-4 text-center">My Schedule</h2>

            <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg mb-6">
                <button onClick={() => setWeekStartDate(subDays(weekStartDate, 7))} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">Previous Week</button>
                <h3 className="text-xl text-white font-semibold">{format(weekStartDate, 'do MMMM yyyy')} - {format(addDays(weekStartDate, 6), 'do MMMM yyyy')}</h3>
                <button onClick={() => setWeekStartDate(addDays(weekStartDate, 7))} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">Next Week</button>
            </div>

            {error && <p className="text-red-500 text-center mb-4">{error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                {weekDays.map(day => {
                    const scheduledShift = myShifts.find(s => format(new Date(s.shift_date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
                    return (
                        <div key={day.toString()} className="bg-gray-800 rounded-lg p-4">
                            <p className="font-bold text-center text-white">{format(day, 'EEE')}</p>
                            <p className="font-normal text-center text-gray-400 text-sm mb-2">{format(day, 'do MMM')}</p>
                            <hr className="border-gray-700" />
                            <div className="mt-2 text-center text-xs">
                                {scheduledShift ? (
                                    <div className="bg-blue-800 text-white p-2 rounded">
                                        <p className="font-bold">{scheduledShift.shift_name}</p>
                                        <p>{scheduledShift.start_time.substring(0, 5)} - {scheduledShift.end_time.substring(0, 5)}</p>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 p-2">No Shift Assigned</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MySchedulePage;