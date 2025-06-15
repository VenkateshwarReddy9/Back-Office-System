// client/src/pages/RotaPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { auth } from '../firebase';
import { format, addDays, subDays, startOfWeek, isWithinInterval } from 'date-fns';

const RotaPage = () => {
    const [weekStartDate, setWeekStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 })); // Monday start
    const [employees, setEmployees] = useState([]);
    const [shiftTemplates, setShiftTemplates] = useState([]);
    const [scheduledShifts, setScheduledShifts] = useState([]);
    const [unavailability, setUnavailability] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // In RotaPage.jsx, after the useState lines

// This useMemo hook calculates total costs and hours whenever the schedule or employees change.
const rotaCalculations = useMemo(() => {
    const employeeData = {};
    let totalWeeklyCost = 0;

    // Initialize every employee
    employees.forEach(emp => {
        employeeData[emp.uid] = { totalHours: 0, totalCost: 0 };
    });

    // Calculate hours and cost for each scheduled shift
    scheduledShifts.forEach(shift => {
        const employee = employees.find(emp => emp.uid === shift.user_uid);
        if (employee) {
            const startTime = new Date(`1970-01-01T${shift.start_time}`);
            const endTime = new Date(`1970-01-01T${shift.end_time}`);
            const durationMillis = endTime - startTime;
            const durationHours = durationMillis / (1000 * 60 * 60);
            const shiftCost = durationHours * parseFloat(employee.pay_rate || 0);

            employeeData[shift.user_uid].totalHours += durationHours;
            employeeData[shift.user_uid].totalCost += shiftCost;
            totalWeeklyCost += shiftCost;
        }
    });

    return { totalWeeklyCost, employeeData };
}, [scheduledShifts, employees]);

    const fetchDataForWeek = async (startDate) => {
        setLoading(true);
        setError('');
        if (!auth.currentUser) {
            setLoading(false);
            return;
        }

        const endDate = addDays(startDate, 6);
        const token = await auth.currentUser.getIdToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            const [employeesRes, templatesRes, rotaRes, availabilityRes] = await Promise.all([
                fetch('http://localhost:5000/api/employees', { headers }),
                fetch('http://localhost:5000/api/shift-templates', { headers }),
                fetch(`http://localhost:5000/api/rota?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`, { headers }),
                fetch(`http://localhost:5000/api/availability/rota?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`, { headers })
            ]);

            if (!employeesRes.ok || !templatesRes.ok || !rotaRes.ok || !availabilityRes.ok) {
                throw new Error("One or more API calls failed.");
            }

            const employeesData = await employeesRes.json();
            const templatesData = await templatesRes.json();
            const rotaData = await rotaRes.json();
            const availabilityData = await availabilityRes.json();

            setEmployees(employeesData.data || []);
            setShiftTemplates(templatesData.data || []);
            setScheduledShifts(rotaData.data || []);
            setUnavailability(availabilityData.data || []);

        } catch (err) {
            console.error('Error fetching rota data:', err);
            setError('Failed to load rota data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDataForWeek(weekStartDate);
    }, [weekStartDate]);

    const handleAssignShift = async (user_uid, shift_template_id, shift_date) => {
        if (!shift_template_id) return;
        
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch('http://localhost:5000/api/rota', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    user_uid, 
                    shift_template_id, 
                    shift_date: format(shift_date, 'yyyy-MM-dd') 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to assign shift.');
            }
            
            fetchDataForWeek(weekStartDate);
        } catch (err) {
            console.error('Error assigning shift:', err);
            alert(err.message);
        }
    };

    const handleRemoveShift = async (scheduledShiftId) => {
        if (!window.confirm("Are you sure you want to remove this shift?")) return;
        
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch(`http://localhost:5000/api/rota/${scheduledShiftId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to remove shift.');
            }
            
            fetchDataForWeek(weekStartDate);
        } catch (err) {
            console.error('Error removing shift:', err);
            alert(err.message);
        }
    };

    // NEW: Function to publish the week's rota
    const handlePublish = async () => {
        if (!window.confirm("Are you sure you want to publish this week's rota? This will make it visible to all scheduled employees.")) return;

        const token = await auth.currentUser.getIdToken();
        const endDate = addDays(weekStartDate, 6);
        try {
            const response = await fetch('http://localhost:5000/api/rota/publish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    start_date: format(weekStartDate, 'yyyy-MM-dd'),
                    end_date: format(endDate, 'yyyy-MM-dd')
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to publish rota.");
            alert(data.message);
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    // Helper function to get unavailability entries for a specific employee and day
    const getUnavailabilityForDay = (employeeUid, day) => {
        return unavailability.filter(avail => 
            avail.user_uid === employeeUid && 
            isWithinInterval(day, { 
                start: new Date(avail.start_time), 
                end: new Date(avail.end_time) 
            })
        );
    };
    
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

    return (
        <div className="p-6">
            <h2 className="text-3xl font-bold text-white mb-4 text-center">Weekly Rota</h2>

            <div className="text-center mb-4 bg-gray-700 p-3 rounded-lg">
    <span className="text-lg font-bold text-gray-300">Projected Weekly Labor Cost: </span>
    <span className="text-2xl font-bold text-yellow-400">£{rotaCalculations.totalWeeklyCost.toFixed(2)}</span>
</div>
            
            {/* Week Navigation */}
            <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg mb-6">
                <button 
                    onClick={() => setWeekStartDate(subDays(weekStartDate, 7))} 
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                    Previous Week
                </button>
                
                <div className="flex items-center gap-4">
                    <h3 className="text-xl text-white font-semibold">
                        {format(weekStartDate, 'do MMMM yyyy')} - {format(addDays(weekStartDate, 6), 'do MMMM yyyy')}
                    </h3>
                    
                    {/* NEW BUTTON */}
                    <button 
                        onClick={handlePublish} 
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        Finalize & Publish Rota
                    </button>
                </div>
                
                <button 
                    onClick={() => setWeekStartDate(addDays(weekStartDate, 7))} 
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                    Next Week
                </button>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-4 text-center">
                    {error}
                </div>
            )}

            {/* Rota Grid */}
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="sticky left-0 bg-gray-700 p-4 font-bold uppercase text-gray-400 z-10">
                                Employee
                            </th>
                            {weekDays.map(day => (
                                <th key={day.toISOString()} className="p-4 font-bold uppercase text-gray-400 text-center min-w-[160px]">
                                    {format(day, 'EEE do')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="8" className="text-center p-8 text-gray-400">
                                    Loading Rota...
                                </td>
                            </tr>
                        ) : employees.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="text-center p-8 text-gray-400">
                                    No employees found
                                </td>
                            </tr>
                        ) : (
                            employees.map(emp => (
                                <tr key={emp.uid} className="border-b border-gray-700 hover:bg-gray-700/30">
                                    <td className="sticky left-0 bg-gray-800 p-4 text-white font-semibold align-top z-10">
    <div>{emp.full_name || emp.email}</div>
    <div className="text-xs font-normal text-gray-400 mt-1">
        <p>Hours: {rotaCalculations.employeeData[emp.uid]?.totalHours.toFixed(1) || '0.0'}</p>
        <p>Cost: £{rotaCalculations.employeeData[emp.uid]?.totalCost.toFixed(2) || '0.00'}</p>
    </div>
</td>
                                    {weekDays.map(day => {
                                        const scheduledShift = scheduledShifts.find(s => 
                                            s.user_uid === emp.uid && 
                                            format(new Date(s.shift_date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
                                        );
                                        
                                        const unavailabilityEntries = getUnavailabilityForDay(emp.uid, day);
                                        const hasUnavailability = unavailabilityEntries.length > 0;

                                        return (
                                            <td key={day.toISOString()} className="p-2 align-top border-l border-gray-700 w-40">
                                                {scheduledShift ? (
                                                    // Employee has a scheduled shift
                                                    <div className="bg-blue-800 text-white p-2 rounded text-center text-xs">
                                                        <p className="font-bold">{scheduledShift.shift_name}</p>
                                                        <p className="text-blue-200">
                                                            {scheduledShift.start_time} - {scheduledShift.end_time}
                                                        </p>
                                                        <button 
                                                            onClick={() => handleRemoveShift(scheduledShift.id)} 
                                                            className="text-red-400 hover:text-red-300 text-xs mt-1 underline transition-colors"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ) : hasUnavailability ? (
                                                    // Employee is unavailable
                                                    <div className="bg-red-900/70 border border-red-700 text-white p-2 rounded text-center text-xs">
                                                        <p className="font-bold text-red-300">UNAVAILABLE</p>
                                                        {unavailabilityEntries.map((entry, index) => (
                                                            <p key={index} className="whitespace-normal text-red-200 mt-1">
                                                                {entry.reason || 'No reason provided'}
                                                            </p>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    // Employee is available - show assignment dropdown
                                                    <select 
                                                        onChange={(e) => handleAssignShift(emp.uid, e.target.value, day)} 
                                                        defaultValue="" 
                                                        className="w-full bg-gray-600 text-white text-xs p-1 rounded border border-gray-500 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="" disabled>
                                                            Assign Shift...
                                                        </option>
                                                        {shiftTemplates.map(st => (
                                                            <option key={st.id} value={st.id}>
                                                                {st.name} ({st.start_time} - {st.end_time})
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-800 rounded"></div>
                    <span className="text-gray-300 text-sm">Scheduled Shift</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-900 border border-red-700 rounded"></div>
                    <span className="text-gray-300 text-sm">Unavailable</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-600 rounded"></div>
                    <span className="text-gray-300 text-sm">Available for Assignment</span>
                </div>
            </div>
        </div>
    );
};

export default RotaPage;
