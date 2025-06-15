// client/src/components/TimeClock.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const TimeClock = () => {
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [clockInTime, setClockInTime] = useState(null);
    const [loading, setLoading] = useState(true);

    // This function checks the user's current status when the page loads
    const checkStatus = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('http://localhost:5000/api/time-clock/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.data && data.data.isClockedIn) {
                setIsClockedIn(true);
                setClockInTime(new Date(data.data.timeEntry.clock_in_timestamp));
            } else {
                setIsClockedIn(false);
                setClockInTime(null);
            }
        } catch (error) {
            console.error("Failed to check clock-in status:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    const handleClockIn = async () => {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('http://localhost:5000/api/time-clock/clock-in', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            alert('Successfully clocked in!');
            checkStatus(); // Refresh status after action
        } else {
            const data = await response.json();
            alert(`Error: ${data.error}`);
        }
    };

    const handleClockOut = async () => {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('http://localhost:5000/api/time-clock/clock-out', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            alert('Successfully clocked out!');
            checkStatus(); // Refresh status after action
        } else {
            const data = await response.json();
            alert(`Error: ${data.error}`);
        }
    };

    if (loading) {
        return (
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 text-center">
                <p className="text-lg text-gray-400">Checking clock-in status...</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 text-center">
            {isClockedIn ? (
                <div>
                    <p className="text-lg text-white">You clocked in at: <span className="font-bold text-green-400">{clockInTime.toLocaleTimeString()}</span></p>
                    <button onClick={handleClockOut} className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-colors">
                        Clock Out
                    </button>
                </div>
            ) : (
                <div>
                    <p className="text-lg text-white">You are currently clocked out.</p>
                    <button onClick={handleClockIn} className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-colors">
                        Clock In
                    </button>
                </div>
            )}
        </div>
    );
};

export default TimeClock;