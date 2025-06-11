// client/src/components/DashboardSummary.jsx

import React from 'react';

// This is a simple "presentational" component. Its only job is to display
// the 'summary' object that it receives as a prop.
const DashboardSummary = ({ summary }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Selected Day's Expenses</h3>
                <p className="text-4xl font-bold text-white mt-2">£{summary.todaysExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Previous Day's Expenses</h3>
                <p className="text-4xl font-bold text-white mt-2">£{summary.yesterdaysExpenses.toFixed(2)}</p>
            </div>
        </div>
    );
};

export default DashboardSummary;