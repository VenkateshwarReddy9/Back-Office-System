// client/src/pages/ShiftTemplatesPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const ShiftTemplatesPage = () => {
    const [templates, setTemplates] = useState([]);
    const [name, setName] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchTemplates = async () => {
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch('http://localhost:5000/api/shift-templates', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setTemplates(data.data || []);
            } else {
                throw new Error(data.error || 'Failed to fetch templates.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if(auth.currentUser) fetchTemplates();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch('http://localhost:5000/api/shift-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, start_time: startTime, end_time: endTime })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create template.');
            setTemplates([...templates, data.data]); // Add new template to the list instantly
            setName(''); // Reset form
        } catch (err) {
            setError(err.message);
        }
    };
    
    const handleDelete = async (templateId) => {
        if (!window.confirm("Are you sure you want to delete this template? All scheduled shifts using this template will also be removed.")) return;
        
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch(`http://localhost:5000/api/shift-templates/${templateId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete template.');
            setTemplates(templates.filter(t => t.id !== templateId)); // Remove from list instantly
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Manage Shift Templates</h2>
            {/* Form for creating new templates */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 max-w-2xl mx-auto">
                <h3 className="text-xl font-bold text-white mb-4">Create New Template</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Shift Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Morning Shift" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">End Time</label>
<input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Create</button>
                </form>
                {error && <p className="text-red-500 mt-4">{error}</p>}
            </div>

            {/* Table of existing templates */}
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="p-4 font-bold uppercase text-gray-400">Name</th>
                            <th className="p-4 font-bold uppercase text-gray-400">Start Time</th>
                            <th className="p-4 font-bold uppercase text-gray-400">End Time</th>
                            <th className="p-4 font-bold uppercase text-gray-400">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="4" className="text-center p-8 text-gray-400">Loading...</td></tr>
                        ) : templates.map(template => (
                            <tr key={template.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="p-4 text-white font-semibold">{template.name}</td>
                                <td className="p-4 text-gray-300">{template.start_time}</td>
                                <td className="p-4 text-gray-300">{template.end_time}</td>
                                <td className="p-4">
                                    <button onClick={() => handleDelete(template.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded-md">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ShiftTemplatesPage;