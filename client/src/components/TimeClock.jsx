// client/src/components/TimeClock.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const TimeClock = () => {
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [clockInTime, setClockInTime] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkStatus = async () => {
        if (!auth.currentUser) return;
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('{apiUrl}/api/time-clock/status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.data.isClockedIn) {
            setIsClockedIn(true);
            setClockInTime(new Date(data.data.timeEntry.clock_in_timestamp));
        } else {
            setIsClockedIn(false);
        }
        setLoading(false);
    };

    useEffect(() => {
        checkStatus();
    }, []);

    const handleClockIn = async () => {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('{apiUrl}/api/time-clock/clock-in', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            alert('Successfully clocked in!');
            checkStatus(); // Refresh status
        } else {
            const data = await response.json();
            alert(`Error: ${data.error}`);
        }
    };

    const handleClockOut = async () => {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('{apiUrl}/api/time-clock/clock-out', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            alert('Successfully clocked out!');
            checkStatus(); // Refresh status
        } else {
            const data = await response.json();
            alert(`Error: ${data.error}`);
        }
    };

    if (loading) return null; // Don't show anything while checking status

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 text-center">
            {isClockedIn ? (
                <div>
                    <p className="text-lg text-white">You clocked in at: <span className="font-bold">{clockInTime.toLocaleTimeString()}</span></p>
                    <button onClick={handleClockOut} className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-xl">
                        Clock Out
                    </button>
                </div>
            ) : (
                <div>
                    <p className="text-lg text-white">You are currently clocked out.</p>
                    <button onClick={handleClockIn} className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-xl">
                        Clock In
                    </button>
                </div>
            )}
        </div>
    );
};

export default TimeClock;