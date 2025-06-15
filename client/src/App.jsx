// client/src/App.jsx

import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, Outlet } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";

// Import Page Components
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import EmployeesPage from './pages/EmployeesPage';
import EditEmployeePage from './pages/EditEmployeePage';
import ShiftTemplatesPage from './pages/ShiftTemplatesPage';
import RotaPage from './pages/RotaPage';
import MyAvailabilityPage from './pages/MyAvailabilityPage';
import MySchedulePage from './pages/MySchedulePage';
import AvailabilityRequestsPage from './pages/AvailabilityRequestsPage';
import TimeEntriesAdminPage from './pages/TimeEntriesAdminPage';
import TimesheetPage from './pages/TimesheetPage';
import LaborReportPage from './pages/LaborReportPage';
import ActivityLogPage from './pages/ActivityLogPage';

// Import UI Components
import AddExpenseForm from './components/AddExpenseForm';
import AddSaleForm from './components/AddSaleForm';
import TransactionList from './components/TransactionList';
import ApprovalQueue from './components/ApprovalQueue';
import TimeClock from './components/TimeClock';
import './App.css';
import logo from './assets/generated-image.png';


// --- HELPER & LAYOUT COMPONENTS ---

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};

// UPDATED AppLayout: container and mx-auto classes removed

const AppLayout = ({ userProfile, onLogout }) => (
  // The main page background remains dark
  <div className="min-h-screen bg-gray-900 text-white">
    {/* The header is now white with a bottom border for separation */}
    <header className="bg-white shadow-md border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-8">
          {/* Logo/Title text is now dark */}
<img src={logo} alt="Back Office Logo" className="h-14" />
          <nav className="hidden md:flex space-x-6">
            {/* Link text is now a darker gray with a blue hover effect */}
            <Link to="/" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">Dashboard</Link>
            {(userProfile.role.includes('admin')) && (
              <>
                <Link to="/my-availability" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">My Availability</Link>
                <Link to="/my-schedule" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">My Schedule</Link>
                <Link to="/users" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">User Access</Link>
                <Link to="/employees" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">Employees</Link>
                <Link to="/rota" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">Rota</Link>
                <Link to="/availability-requests" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">Time Off Requests</Link>
                <Link to="/shift-templates" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">Shift Templates</Link>
                <Link to="/timesheet" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">Timesheets</Link>
                <Link to="/reports/labor" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">Labor Report</Link>
                <Link to="/activity-log" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">Activity Log</Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          {/* Greeting text is now a mid-range gray */}
          <span className="text-gray-500 text-sm hidden sm:block">{getGreeting()}, {userProfile.email}</span>
          <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">Logout</button>
        </div>
      </div>
    </header>
    <main className="p-4 sm:p-6 lg:p-8">
      <Outlet />
    </main>
  </div>
);

// --- NEW DashboardSummary with Profit Calculation ---
const DashboardSummary = ({ summary }) => {
    const todaysProfit = summary.todaysSales - summary.todaysExpenses;
    const yesterdaysProfit = summary.yesterdaysSales - summary.yesterdaysExpenses;

    const profitClass = (profit) => profit >= 0 ? 'text-green-400' : 'text-red-400';

    return (
        <div className="space-y-6 mb-8">
            {/* Top row of cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Today's Sales</h3>
                    <p className="text-3xl font-bold text-green-400 mt-2">£{summary.todaysSales.toFixed(2)}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Today's Expenses</h3>
                    <p className="text-3xl font-bold text-red-400 mt-2">£{summary.todaysExpenses.toFixed(2)}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Yesterday's Sales</h3>
                    <p className="text-3xl font-bold text-white mt-2">£{summary.yesterdaysSales.toFixed(2)}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Yesterday's Expenses</h3>
                    <p className="text-3xl font-bold text-white mt-2">£{summary.yesterdaysExpenses.toFixed(2)}</p>
                </div>
            </div>
            {/* Bottom row for Profit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                    <h3 className="text-white text-lg font-bold uppercase tracking-wider">Today's Balance</h3>
                    <p className={`text-5xl font-bold mt-2 ${profitClass(todaysProfit)}`}>
                        {todaysProfit >= 0 ? `£${todaysProfit.toFixed(2)}` : `-£${Math.abs(todaysProfit).toFixed(2)}`}
                    </p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                    <h3 className="text-white text-lg font-bold uppercase tracking-wider">Yesterday's Balance</h3>
                    <p className={`text-5xl font-bold mt-2 ${profitClass(yesterdaysProfit)}`}>
                        {yesterdaysProfit >= 0 ? `£${yesterdaysProfit.toFixed(2)}` : `-£${Math.abs(yesterdaysProfit).toFixed(2)}`}
                    </p>
                </div>
            </div>
        </div>
    );
};

// Dashboard supports both sales and expenses with summary and color-coded transactions
// In client/src/App.jsx, replace the entire Dashboard component with this

const Dashboard = ({ userProfile }) => {
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({ todaysExpenses: 0, yesterdaysExpenses: 0, todaysSales: 0, yesterdaysSales: 0 });
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [editingTransaction, setEditingTransaction] = useState(null);

    const isAdmin = userProfile.role.includes('admin');

    const refreshData = (date) => {
        if (!auth.currentUser || !userProfile) return;
        auth.currentUser.getIdToken().then(token => {
            const headers = { 'Authorization': `Bearer ${token}` };
            const dateQuery = `?date=${date}`;
            
            const endpoint = isAdmin ? `/api/transactions/all${dateQuery}` : `/api/transactions${dateQuery}`;
            fetch(`http://localhost:5000${endpoint}`, { headers })
                .then(res => res.json())
                .then(data => {
                    const sortedData = (data.data || []).sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
                    setTransactions(sortedData);
                });

            if (isAdmin) {
                fetch(`{apiUrl}/api/dashboard/summary${dateQuery}`, { headers })
                    .then(res => res.json())
                    .then(data => setSummary(prev => ({...prev, ...data.data})));
                
                // We can also refresh the approval queue data here
                // Note: The ApprovalQueue component also fetches its own data, this is an extra refresh
                // For a larger app, we would lift the approval queue state up as well.
                fetch(`{apiUrl}/api/approval-requests`, { headers });
            }
        });
    };
    
    useEffect(() => {
        refreshData(selectedDate);
    }, [selectedDate, userProfile]);

    const handleActionComplete = () => {
        setEditingTransaction(null);
        refreshData(selectedDate);
    };

    const handleEditClick = (transaction) => {
        setEditingTransaction(transaction);
        window.scrollTo(0, 0);
    };
    
    // --- THIS IS THE KEY CHANGE ---
    // We filter the master transaction list into two separate arrays
    const salesTransactions = transactions.filter(t => t.type === 'sale');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');

    return (
        <>
        {!isAdmin && <TimeClock />}
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
                    <ApprovalQueue onActionComplete={handleActionComplete} />
                </>
            )}

            {editingTransaction ? (
                // If we are editing, show only the correct form
                editingTransaction.type === 'sale' 
                    ? <AddSaleForm transactionToEdit={editingTransaction} onUpdate={handleActionComplete} onCancelEdit={() => setEditingTransaction(null)} />
                    : <AddExpenseForm transactionToEdit={editingTransaction} onUpdate={handleActionComplete} onCancelEdit={() => setEditingTransaction(null)} />
            ) : (
                // If not editing, show both "Add" forms
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <AddSaleForm onNewSale={handleActionComplete} />
                    <AddExpenseForm onNewExpense={handleActionComplete} />
                </div>
            )}

            {/* A two-column grid to display the lists side-by-side */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <TransactionList 
                    title="Sales"
                    transactions={salesTransactions} 
                    userProfile={userProfile}
                    onEdit={handleEditClick}
                    onActionComplete={handleActionComplete}
                />
                <TransactionList 
                    title="Expenses"
                    transactions={expenseTransactions} 
                    userProfile={userProfile}
                    onEdit={handleEditClick}
                    onActionComplete={handleActionComplete}
                />
            </div>
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
          fetch('{apiUrl}/api/me', { headers: { 'Authorization': `Bearer ${token}` } })
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
        <Route path="employees" element={ (userProfile && userProfile.role.includes('admin')) ? <EmployeesPage /> : <Navigate to="/" /> } />
        <Route path="employees/:uid/edit" element={ (userProfile && userProfile.role.includes('admin')) ? <EditEmployeePage /> : <Navigate to="/" /> } />
        <Route path="shift-templates" element={ (userProfile && userProfile.role.includes('admin')) ? <ShiftTemplatesPage /> : <Navigate to="/" /> } />
        <Route path="rota" element={ (userProfile && userProfile.role.includes('admin')) ? <RotaPage /> : <Navigate to="/" /> } />
        <Route path="time-entries" element={ (userProfile && userProfile.role.includes('admin')) ? <TimeEntriesAdminPage /> : <Navigate to="/" /> } />
        <Route path="my-availability" element={<MyAvailabilityPage />} />
        <Route path="activity-log" element={ (userProfile && userProfile.role.includes('admin')) ? <ActivityLogPage /> : <Navigate to="/" /> } />
        <Route path="my-schedule" element={<MySchedulePage />} />
        <Route path="availability-requests" element={ (userProfile && userProfile.role.includes('admin')) ? <AvailabilityRequestsPage /> : <Navigate to="/" /> } />
        <Route path="timesheet" element={ (userProfile && userProfile.role.includes('admin')) ? <TimesheetPage /> : <Navigate to="/" /> } />
        <Route path="reports/labor" element={ (userProfile && userProfile.role.includes('admin')) ? <LaborReportPage /> : <Navigate to="/" /> } />
      </Route>
    </Routes>
  );
}

export default App;
