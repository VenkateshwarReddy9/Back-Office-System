// client/src/App.jsx

import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, Outlet } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";

// Import Page Components
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import ActivityLogPage from './pages/ActivityLogPage';

// Import UI Components
import AddExpenseForm from './components/AddExpenseForm';
import TransactionList from './components/TransactionList';
import ApprovalQueue from './components/ApprovalQueue';
import DashboardSummary from './components/DashboardSummary';
import './App.css';

// --- HELPER & LAYOUT COMPONENTS ---

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};

const AppLayout = ({ userProfile, onLogout }) => (
  <div className="min-h-screen bg-gray-900 text-white">
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-bold text-white">Ledger</h1>
          <nav className="hidden md:flex space-x-6">
            <Link to="/" className="text-gray-300 hover:text-white transition-colors duration-200">Dashboard</Link>
            {(userProfile.role === 'primary_admin' || userProfile.role === 'secondary_admin') && (
              <>
                <Link to="/users" className="text-gray-300 hover:text-white transition-colors duration-200">Manage Users</Link>
                <Link to="/activity-log" className="text-gray-300 hover:text-white transition-colors duration-200">Activity Log</Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-gray-400 text-sm hidden sm:block">{getGreeting()}, {userProfile.email}</span>
          <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">Logout</button>
        </div>
      </div>
    </header>
    <main className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Outlet />
    </main>
  </div>
);

// This component is the main dashboard content, now fully connected
const Dashboard = ({ userProfile }) => {
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({ todaysExpenses: 0, yesterdaysExpenses: 0 });
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [editingTransaction, setEditingTransaction] = useState(null);

    const isAdmin = userProfile.role === 'primary_admin' || userProfile.role === 'secondary_admin';

    // This is our single "refresh" function for the whole dashboard
    const refreshData = (date) => {
        if (!auth.currentUser || !userProfile) return;
        auth.currentUser.getIdToken().then(token => {
            const headers = { 'Authorization': `Bearer ${token}` };
            const dateQuery = `?date=${date}`;

            const transactionsEndpoint = isAdmin ? `/api/transactions/all${dateQuery}` : `/api/transactions${dateQuery}`;
            fetch(`http://localhost:5000${transactionsEndpoint}`, { headers })
                .then(res => res.json())
                .then(data => setTransactions(data.data || []));

            if (isAdmin) {
                fetch(`http://localhost:5000/api/dashboard/summary${dateQuery}`, { headers })
                    .then(res => res.json())
                    .then(data => setSummary(data.data || { todaysExpenses: 0, yesterdaysExpenses: 0 }));
                // Also refresh the approval queue
                fetch(`http://localhost:5000/api/approval-requests`, { headers })
                    .then(res => res.json())
            }
        });
    };

    useEffect(() => {
        refreshData(selectedDate);
    }, [selectedDate, userProfile]);

    const handleActionComplete = () => {
        setEditingTransaction(null); // Close edit form if open
        refreshData(selectedDate); // Re-fetch all data for the current date
    };
    
    return (
        <>
            {isAdmin && (
                <>
                    <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6 flex items-center justify-center space-x-4">
                        <label htmlFor="date-picker" className="font-bold text-white">Select Date:</label>
                        <input
                            type="date"
                            id="date-picker"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-gray-700 text-white p-2 rounded-lg border border-gray-600"
                        />
                    </div>
                    <DashboardSummary summary={summary} />
                    {/* Pass the refresh function down as a prop */}
                    <ApprovalQueue onActionComplete={handleActionComplete} />
                </>
            )}
            <AddExpenseForm 
                onNewExpense={handleActionComplete}
                transactionToEdit={editingTransaction}
                onUpdate={handleActionComplete}
                onCancelEdit={() => setEditingTransaction(null)}
            />
            <TransactionList 
                transactions={transactions} 
                userProfile={userProfile}
                onEdit={(transaction) => setEditingTransaction(transaction)}
                onActionComplete={handleActionComplete} // Pass refresh function here too
            />
        </>
    );
};


// --- MAIN APP COMPONENT ---
function App() {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        firebaseUser.getIdToken().then(token => {
          fetch('http://localhost:5000/api/me', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(profileData => {
              if (profileData.uid) { setUserProfile(profileData); } 
              else { signOut(auth); setUserProfile(null); }
              setLoading(false);
            }).catch(() => { signOut(auth); setUserProfile(null); setLoading(false); });
        });
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={!userProfile ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/*" element={ userProfile ? <AppLayout userProfile={userProfile} onLogout={() => signOut(auth)} /> : <Navigate to="/login" /> }>
        <Route index element={<Dashboard userProfile={userProfile} />} />
        <Route path="users" element={ (userProfile && userProfile.role.includes('admin')) ? <UserManagementPage userProfile={userProfile} /> : <Navigate to="/" /> } />
        <Route path="activity-log" element={ (userProfile && userProfile.role.includes('admin')) ? <ActivityLogPage /> : <Navigate to="/" /> } />
      </Route>
    </Routes>
  );
}

export default App;