// client/src/pages/MyAvailabilityPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const apiUrl = import.meta.env.VITE_API_URL;
const MyAvailabilityPage = () => {
    const [availability, setAvailability] = useState([]);
    const [reason, setReason] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const user = auth.currentUser;

    const fetchAvailability = async () => {
        if (!user) return;
        setLoading(true);
        const token = await user.getIdToken();
        try {
            const response = await fetch(`{apiUrl}/api/availability?user_uid=${user.uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch availability.');
            const data = await response.json();
            setAvailability(data.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchAvailability();
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!startTime || !endTime) {
            setError('Please select both a start and end time.');
            return;
        }
        try {
            const token = await user.getIdToken();
            await fetch('{apiUrl}/api/availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ start_time: startTime, end_time: endTime, reason })
            });
            fetchAvailability(); // Refresh the list
            setReason(''); setStartTime(''); setEndTime('');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (availabilityId) => {
        if (!window.confirm('Are you sure you want to delete this request?')) return;
        if (!user) return;
        const token = await user.getIdToken();
        try {
            const response = await fetch(`{apiUrl}/api/availability/${availabilityId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete request.');
            fetchAvailability(); // Refresh list on success
        } catch (err) {
            setError(err.message);
        }
    };
    
    // Helper to get styling for status badges
    const getStatusClass = (status) => {
        if (status === 'approved') return 'bg-green-500 text-green-100';
        if (status === 'pending') return 'bg-yellow-500 text-yellow-100';
        return 'bg-gray-500 text-gray-100';
    }

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-8 text-center">My Availability & Time Off</h2>
            
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 max-w-3xl mx-auto">
                <h3 className="text-xl font-bold text-white mb-4">Request Time Off</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
                            <input 
                                type="datetime-local" 
                                value={startTime} 
                                onChange={e => setStartTime(e.target.value)} 
                                required 
                                className="w-full p-2 bg-gray-700 rounded-lg border border-gray-600 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">End Time</label>
                            <input 
                                type="datetime-local" 
                                value={endTime} 
                                onChange={e => setEndTime(e.target.value)} 
                                required 
                                className="w-full p-2 bg-gray-700 rounded-lg border border-gray-600 text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Reason (Optional)</label>
                        <input 
                            type="text" 
                            value={reason} 
                            onChange={e => setReason(e.target.value)} 
                            placeholder="e.g., Doctor's Appointment" 
                            className="w-full p-2 bg-gray-700 rounded-lg border border-gray-600 text-white"
                        />
                    </div>
                    <div className="flex justify-end">
                        <button 
                            type="submit" 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg"
                        >
                            Submit Request
                        </button>
                    </div>
                    {error && <p className="text-red-500 mt-2">{error}</p>}
                </form>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-3xl mx-auto">
                <h3 className="text-xl font-bold text-white mb-4">Your Submitted Requests</h3>
                <ul className="space-y-3">
                    {loading ? <p className="text-gray-400">Loading...</p> : availability.map(req => (
                        <li key={req.id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-white">{req.reason || 'Time Off'}</p>
                                <p className="text-xs text-gray-400">
                                    {new Date(req.start_time).toLocaleString()} to {new Date(req.end_time).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex items-center space-x-3">
                                {/* Status Badge */}
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusClass(req.status)}`}>
                                    {req.status}
                                </span>
                                {/* Only allow deleting pending requests */}
                                {req.status === 'pending' && (
                                    <button 
                                        onClick={() => handleDelete(req.id)} 
                                        className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded-md"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                    {!loading && availability.length === 0 && <p className="text-gray-400">You have no time off requests.</p>}
                </ul>
            </div>
        </div>
    );
};

export default MyAvailabilityPage;
