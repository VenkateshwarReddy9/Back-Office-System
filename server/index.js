// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');
const db = require('./database.js');

db.createTables();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// --- MIDDLEWARES & HELPERS ---
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) { 
        return res.status(401).send('Unauthorized: No token provided.'); 
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const upsertSql = `INSERT INTO "users" (uid, email, role, status) VALUES ($1, $2, 'staff', 'active') ON CONFLICT (uid) DO NOTHING;`;
        await db.query(upsertSql, [decodedToken.uid, decodedToken.email]);
        const selectSql = `SELECT * FROM "users" WHERE uid = $1`;
        const { rows } = await db.query(selectSql, [decodedToken.uid]);
        if (rows.length === 0) return res.status(500).send("Error: Could not retrieve user profile.");
        const user = rows[0];
        if (user.status === 'inactive') return res.status(403).send('Forbidden: Your account has been disabled.');
        req.user = { ...decodedToken, role: user.role, status: user.status };
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(403).send('Unauthorized: Invalid token or server error.');
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'primary_admin' || req.user.role === 'secondary_admin')) { 
        next(); 
    } else { 
        res.status(403).send('Forbidden: Admins only.'); 
    }
};

const logActivity = async (user, action_type, details = '') => {
    const sql = `INSERT INTO activity_logs (user_uid, user_email, action_type, details) VALUES ($1, $2, $3, $4)`;
    try { 
        await db.query(sql, [user.uid, user.email, action_type, details]); 
    } catch (err) { 
        console.error("Failed to log activity:", err.message); 
    }
};

// --- API ROUTES ---
app.get('/api/me', authMiddleware, (req, res) => {
    res.json({ uid: req.user.uid, email: req.user.email, role: req.user.role, status: req.user.status });
});

app.get('/api/transactions', authMiddleware, async (req, res) => {
    const { date } = req.query;
    const user_uid = req.user.uid;
    let sql = `SELECT * FROM transactions WHERE user_uid = $1`;
    const params = [user_uid];

    if (date) {
        sql += ` AND DATE(transaction_date) = $2`;
        params.push(date);
    }
    sql += ` ORDER BY transaction_date DESC`;
    
    try {
        const { rows } = await db.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions', authMiddleware, async (req, res) => {
    // It now correctly expects all these fields from the frontend forms
    const { description, amount, transaction_date, type, category } = req.body;
    
    if (!description || !amount || !type) {
        return res.status(400).json({ error: "Description, amount, and type are required." });
    }

    const dateToInsert = transaction_date ? new Date(transaction_date) : new Date();

    // The SQL command now includes the 'category' column
    const sql = 'INSERT INTO transactions (user_uid, description, amount, transaction_date, type, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
    const params = [req.user.uid, description, amount, dateToInsert, type, category || null];
    
    try {
        const { rows } = await db.query(sql, params);
        const logType = type === 'sale' ? 'CREATE_SALE' : 'CREATE_EXPENSE';
        logActivity(req.user, logType, `Desc: ${description}, Cat: ${category}, Amt: ${amount}`);
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        console.error("Error in POST /api/transactions:", err);
        res.status(400).json({"error": err.message});
    }
});

app.post('/api/transactions/:id/request-delete', authMiddleware, async (req, res) => {
    const transactionId = req.params.id;
    const sql = "UPDATE transactions SET status = 'pending_delete' WHERE id = $1 AND user_uid = $2";
    try {
        const result = await db.query(sql, [transactionId, req.user.uid]);
        if (result.rowCount === 0) return res.status(404).json({ "error": "Transaction not found or user not authorized." });
        logActivity(req.user, 'REQUEST_DELETION', `Transaction ID: ${transactionId}`);
        res.json({ message: "Deletion request submitted for approval." });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});


app.get('/api/availability', authMiddleware, async (req, res) => {
    // Fetches availability for a specific user, e.g., /api/availability?user_uid=...
    const userToFetch = req.query.user_uid;
    const requestingUser = req.user;

    // An admin can fetch for anyone, but a staff member can only fetch for themselves.
    if (!requestingUser.role.includes('admin') && requestingUser.uid !== userToFetch) {
        return res.status(403).json({ error: "You are not authorized to view this user's availability." });
    }

    const sql = 'SELECT * FROM availability WHERE user_uid = $1 ORDER BY start_time ASC';
    try {
        const { rows } = await db.query(sql, [userToFetch]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.post('/api/availability', authMiddleware, async (req, res) => {
    const { start_time, end_time, reason, is_all_day } = req.body;
    if (!start_time || !end_time) {
        return res.status(400).json({ error: "Start time and end time are required." });
    }
    // A user can only add availability for themselves, so we get the uid from the token.
    const user_uid = req.user.uid;

    const sql = `INSERT INTO availability (user_uid, start_time, end_time, reason, is_all_day) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    try {
        const { rows } = await db.query(sql, [user_uid, start_time, end_time, reason, is_all_day || false]);
        logActivity(req.user, 'ADD_UNAVAILABILITY', `From ${start_time} to ${end_time}`);
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.delete('/api/availability/:id', authMiddleware, async (req, res) => {
    const availabilityId = req.params.id;
    const user = req.user;

    // First, verify that the entry belongs to the user trying to delete it (or that the user is an admin).
    const verifySql = 'SELECT user_uid FROM availability WHERE id = $1';
    const verifyResult = await db.query(verifySql, [availabilityId]);

    if (verifyResult.rows.length === 0) {
        return res.status(404).json({ error: 'Availability entry not found.' });
    }
    if (verifyResult.rows[0].user_uid !== user.uid && !user.role.includes('admin')) {
        return res.status(403).json({ error: 'You are not authorized to delete this entry.' });
    }

    const deleteSql = `DELETE FROM availability WHERE id = $1`;
    try {
        await db.query(deleteSql, [availabilityId]);
        logActivity(user, 'DELETE_UNAVAILABILITY', `Deleted availability entry ID: ${availabilityId}`);
        res.status(200).json({ message: 'Availability entry deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/my-schedule', authMiddleware, async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: "start_date and end_date are required." });
    }
    // This query gets only the logged-in user's shifts that are published
    const sql = `
        SELECT s.id, s.shift_date, st.name as shift_name, st.start_time, st.end_time 
        FROM scheduled_shifts s
        JOIN shift_templates st ON s.shift_template_id = st.id
        WHERE s.user_uid = $1 AND s.is_published = true AND s.shift_date BETWEEN $2 AND $3
        ORDER BY s.shift_date ASC
    `;
    try {
        const { rows } = await db.query(sql, [req.user.uid, start_date, end_date]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.post('/api/time-clock/clock-in', authMiddleware, async (req, res) => {
    const user = req.user;
    // Optional: Find the user's currently scheduled shift to link it.
    // For now, we'll keep it simple and just record the clock-in time.
    const sql = `INSERT INTO time_entries (user_uid, clock_in_timestamp) VALUES ($1, NOW()) RETURNING *`;
    try {
        // Check if user has an open clock-in already
        const checkSql = 'SELECT * FROM time_entries WHERE user_uid = $1 AND clock_out_timestamp IS NULL';
        const { rows: openShifts } = await db.query(checkSql, [user.uid]);
        if (openShifts.length > 0) {
            return res.status(400).json({ error: "You have already clocked in. Please clock out before clocking in again." });
        }

        const { rows } = await db.query(sql, [user.uid]);
        logActivity(user, 'CLOCK_IN', `User clocked in.`);
        res.status(201).json({ message: 'Successfully clocked in.', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Could not process clock-in." });
    }
});


app.post('/api/time-clock/clock-out', authMiddleware, async (req, res) => {
    const user = req.user;
    try {
        // Find the most recent open time entry for this user
        const findSql = 'SELECT * FROM time_entries WHERE user_uid = $1 AND clock_out_timestamp IS NULL ORDER BY clock_in_timestamp DESC LIMIT 1';
        const { rows: openShifts } = await db.query(findSql, [user.uid]);

        if (openShifts.length === 0) {
            return res.status(404).json({ error: "No open shift found to clock out from." });
        }

        const timeEntry = openShifts[0];
        const clockInTime = new Date(timeEntry.clock_in_timestamp);
        const clockOutTime = new Date(); // Now

        // Calculate hours worked
        const durationMillis = clockOutTime - clockInTime;
        const durationHours = durationMillis / (1000 * 60 * 60);

        const updateSql = `UPDATE time_entries SET clock_out_timestamp = NOW(), actual_hours_worked = $1 WHERE id = $2 RETURNING *`;
        const { rows } = await db.query(updateSql, [durationHours.toFixed(2), timeEntry.id]);

        logActivity(user, 'CLOCK_OUT', `User clocked out. Hours worked: ${durationHours.toFixed(2)}`);
        res.json({ message: 'Successfully clocked out.', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Could not process clock-out." });
    }
});


// GET the current clock-in status for the logged-in user
app.get('/api/time-clock/status', authMiddleware, async (req, res) => {
    const sql = 'SELECT * FROM time_entries WHERE user_uid = $1 AND clock_out_timestamp IS NULL ORDER BY clock_in_timestamp DESC LIMIT 1';
    try {
        const { rows } = await db.query(sql, [req.user.uid]);
        if (rows.length > 0) {
            // User is currently clocked in
            res.json({ data: { isClockedIn: true, timeEntry: rows[0] } });
        } else {
            // User is not clocked in
            res.json({ data: { isClockedIn: false, timeEntry: null } });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// admin only.

app.put('/api/transactions/:id', authMiddleware, adminOnly, async (req, res) => {
    const transactionId = req.params.id;
    // We expect a 'reason' for the edit from the frontend form
    const { description, amount, transaction_date, category, reason } = req.body;

    if (!description || !amount || !transaction_date || !reason) {
        return res.status(400).json({ error: "Description, amount, date, and reason for edit are required." });
    }

    try {
        // Step 1: First, get the transaction *before* we change it.
        const beforeSql = 'SELECT * FROM transactions WHERE id = $1';
        const beforeResult = await db.query(beforeSql, [transactionId]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: "Transaction not found." });
        }
        const oldData = beforeResult.rows[0];

        // Step 2: Now, update the transaction in the database.
        const updateSql = `
            UPDATE transactions 
            SET description = $1, amount = $2, transaction_date = $3, category = $4 
            WHERE id = $5 
            RETURNING *
        `;
        const params = [description, amount, transaction_date, category, transactionId];
        const { rows } = await db.query(updateSql, params);
        const newData = rows[0];

        // Step 3: Compare the old and new data to build the detailed log message.
        let changes = [];
        if (oldData.description !== newData.description) {
            changes.push(`Description updated.`);
        }
        // Use parseFloat to ensure we are comparing numbers, not strings
        if (parseFloat(oldData.amount) !== parseFloat(newData.amount)) {
            changes.push(`Amount changed from £${parseFloat(oldData.amount).toFixed(2)} to £${parseFloat(newData.amount).toFixed(2)}.`);
        }
        if (new Date(oldData.transaction_date).getTime() !== new Date(newData.transaction_date).getTime()) {
            changes.push(`Date changed.`);
        }
        if ((oldData.category || '') !== (newData.category || '')) {
            changes.push(`Category changed from "${oldData.category || 'N/A'}" to "${newData.category || 'N/A'}".`);
        }
        
        const detailsString = changes.length > 0 ? changes.join(' ') : 'No data fields were changed.';
        logActivity(req.user, 'UPDATE_TRANSACTION', `Reason: ${reason}. Changes: ${detailsString}`);
        
        res.status(200).json({ message: "Transaction updated successfully", data: newData });

    } catch (err) {
        console.error("Error updating transaction:", err);
        res.status(500).json({ error: "Failed to update transaction." });
    }
});

app.delete('/api/transactions/:id', authMiddleware, adminOnly, async (req, res) => {
    const transactionId = req.params.id;
    const sql = "DELETE FROM transactions WHERE id = $1";
    try {
        const result = await db.query(sql, [transactionId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ "error": "Transaction not found." });
        }
        logActivity(req.user, 'ADMIN_DELETE_TRANSACTION', `Admin directly deleted Transaction ID: ${transactionId}`);
        res.status(200).json({ message: "Transaction permanently deleted." });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// --- ADMIN ONLY ROUTES ---
app.get('/api/transactions/all', authMiddleware, adminOnly, async (req, res) => {
    const { date } = req.query;
    let sql = `SELECT t.*, u.email AS user_email FROM transactions t JOIN users u ON t.user_uid = u.uid`;
    const params = [];
    if (date) {
        sql += ` WHERE DATE(t.transaction_date) = $1`;
        params.push(date);
    }
    sql += ` ORDER BY t.transaction_date DESC`;
    
    try {
        const { rows } = await db.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/approval-requests', authMiddleware, adminOnly, async (req, res) => {
    const sql = `SELECT t.*, u.email AS user_email FROM transactions t JOIN users u ON t.user_uid = u.uid WHERE t.status = 'pending_delete' ORDER BY t.transaction_date ASC`;
    try {
        const { rows } = await db.query(sql);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/:id/approve-delete', authMiddleware, adminOnly, async (req, res) => {
    const transactionId = req.params.id;
    const sql = "DELETE FROM transactions WHERE id = $1";
    try {
        await db.query(sql, [transactionId]);
        logActivity(req.user, 'APPROVE_DELETION', `Transaction ID: ${transactionId}`);
        res.json({ message: "Deletion approved. Transaction removed." });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.post('/api/transactions/:id/reject-delete', authMiddleware, adminOnly, async (req, res) => {
    const transactionId = req.params.id;
    const sql = "UPDATE transactions SET status = 'approved' WHERE id = $1";
    try {
        await db.query(sql, [transactionId]);
        logActivity(req.user, 'REJECT_DELETION', `Transaction ID: ${transactionId}`);
        res.json({ message: "Deletion rejected. Transaction restored." });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.get('/api/dashboard/summary', authMiddleware, adminOnly, async (req, res) => {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const yesterday = new Date(targetDate);
    yesterday.setDate(targetDate.getDate() - 1);
    const targetDateString = targetDate.toISOString().split('T')[0];
    const yesterdayString = yesterday.toISOString().split('T')[0];

    try {
        const [expenseToday, expenseYesterday, salesToday, salesYesterday] = await Promise.all([
            db.query("SELECT SUM(amount) AS total FROM transactions WHERE type = 'expense' AND DATE(transaction_date) = $1", [targetDateString]),
            db.query("SELECT SUM(amount) AS total FROM transactions WHERE type = 'expense' AND DATE(transaction_date) = $1", [yesterdayString]),
            db.query("SELECT SUM(amount) AS total FROM transactions WHERE type = 'sale' AND DATE(transaction_date) = $1", [targetDateString]),
            db.query("SELECT SUM(amount) AS total FROM transactions WHERE type = 'sale' AND DATE(transaction_date) = $1", [yesterdayString]),
        ]);

        res.json({
            data: {
                todaysExpenses: parseFloat(expenseToday.rows[0].total || 0),
                yesterdaysExpenses: parseFloat(expenseYesterday.rows[0].total || 0),
                todaysSales: parseFloat(salesToday.rows[0].total || 0),
                yesterdaysSales: parseFloat(salesYesterday.rows[0].total || 0),
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch dashboard summary." });
    }
});

app.get('/api/users', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT uid, email, role, status FROM users");
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js, replace the existing POST /api/users
app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
    // Now accepts new employee details
    const { email, password, role, fullName, jobRole, payRate, phoneNumber } = req.body;
    try {
        const userRecord = await admin.auth().createUser({ email, password });
        const sql = `
            INSERT INTO users (uid, email, role, status, full_name, job_role, pay_rate, phone_number) 
            VALUES ($1, $2, $3, 'active', $4, $5, $6, $7) 
            RETURNING *
        `;
        const params = [userRecord.uid, email, role, fullName, jobRole, payRate, phoneNumber];
        const { rows } = await db.query(sql, params);
        logActivity(req.user, 'CREATE_USER', `New user: ${email}, Role: ${role}`);
        res.status(201).json({ message: "User created successfully", data: rows[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/users/:uid', authMiddleware, adminOnly, async (req, res) => {
    const userUidToDisable = req.params.uid;
    if (req.user.uid === userUidToDisable) {
        return res.status(400).json({ error: "Admins cannot disable their own account." });
    }
    try {
        await admin.auth().updateUser(userUidToDisable, { disabled: true });
        const sql = `UPDATE users SET status = 'inactive' WHERE uid = $1`;
        await db.query(sql, [userUidToDisable]);
        logActivity(req.user, 'DISABLE_USER', `Disabled user with UID: ${userUidToDisable}`);
        res.status(200).json({ message: `Successfully disabled user. Their data has been preserved.` });
    } catch (error) {
        res.status(500).json({ error: "Failed to disable user." });
    }
});

app.get('/api/activity-logs', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM activity_logs ORDER BY timestamp DESC");
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js

// In server/index.js, inside the ADMIN ONLY section

app.post('/api/shift-templates', authMiddleware, adminOnly, async (req, res) => {
    const { name, start_time, end_time, color_code } = req.body;
    if (!name || !start_time || !end_time) {
        return res.status(400).json({ error: "Name, start time, and end time are required." });
    }
    const sql = `INSERT INTO shift_templates (name, start_time, end_time, color_code) VALUES ($1, $2, $3, $4) RETURNING *`;
    try {
        const { rows } = await db.query(sql, [name, start_time, end_time, color_code]);
        logActivity(req.user, 'CREATE_SHIFT_TEMPLATE', `Created template: ${name}`);
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js

app.get('/api/shift-templates', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM shift_templates ORDER BY start_time');
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js

app.put('/api/shift-templates/:id', authMiddleware, adminOnly, async (req, res) => {
    const { name, start_time, end_time, color_code } = req.body;
    if (!name || !start_time || !end_time) {
        return res.status(400).json({ error: "Name, start time, and end time are required." });
    }
    const sql = `UPDATE shift_templates SET name = $1, start_time = $2, end_time = $3, color_code = $4 WHERE id = $5 RETURNING *`;
    try {
        const { rows } = await db.query(sql, [name, start_time, end_time, color_code, req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Shift template not found.' });
        logActivity(req.user, 'UPDATE_SHIFT_TEMPLATE', `Updated template ID: ${req.params.id}`);
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js

app.delete('/api/shift-templates/:id', authMiddleware, adminOnly, async (req, res) => {
    const sql = `DELETE FROM shift_templates WHERE id = $1`;
    try {
        const result = await db.query(sql, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Shift template not found.' });
        logActivity(req.user, 'DELETE_SHIFT_TEMPLATE', `Deleted template ID: ${req.params.id}`);
        res.status(200).json({ message: 'Shift template deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js

// In server/index.js, replace the existing /api/availability/rota
app.get('/api/availability/rota', authMiddleware, adminOnly, async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: "start_date and end_date are required." });
    }
    // This query now only finds APPROVED unavailability that overlaps with the week being viewed
    const sql = `SELECT * FROM availability WHERE status = 'approved' AND start_time < $2 AND end_time > $1`;
    try {
        const { rows } = await db.query(sql, [start_date, end_date]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js

app.post('/api/rota', authMiddleware, adminOnly, async (req, res) => {
    const { user_uid, shift_template_id, shift_date } = req.body;
    if (!user_uid || !shift_template_id || !shift_date) {
        return res.status(400).json({ error: "user_uid, shift_template_id, and shift_date are required." });
    }
    const sql = `INSERT INTO scheduled_shifts (user_uid, shift_template_id, shift_date) VALUES ($1, $2, $3) RETURNING *`;
    try {
        const { rows } = await db.query(sql, [user_uid, shift_template_id, shift_date]);
        logActivity(req.user, 'CREATE_SCHEDULE', `Scheduled user ${user_uid} for shift ${shift_template_id} on ${shift_date}`);
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        // Catches errors like trying to schedule the same person twice on the same day
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js

app.delete('/api/rota/:id', authMiddleware, adminOnly, async (req, res) => {
    const scheduledShiftId = req.params.id;
    const sql = `DELETE FROM scheduled_shifts WHERE id = $1`;
    try {
        const result = await db.query(sql, [scheduledShiftId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Scheduled shift not found.' });
        logActivity(req.user, 'DELETE_SCHEDULE', `Deleted scheduled shift ID: ${scheduledShiftId}`);
        res.status(200).json({ message: 'Scheduled shift deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Note: This is a development-only route and should be removed before a real deployment.
app.post('/api/users/make-admin', authMiddleware, async (req, res) => {
    const sql = "UPDATE users SET role = 'primary_admin' WHERE uid = $1";
    try {
        await db.query(sql, [req.user.uid]);
        logActivity(req.user, 'PROMOTE_ADMIN', `Promoted user: ${req.user.email}`);
        res.json({ message: `User ${req.user.email} has been promoted to Primary Admin.`});
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});


// GET all employees with their detailed profiles (Admin Only)
app.get('/api/employees', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT uid, email, role, status, full_name, phone_number, job_role, pay_rate FROM users ORDER BY full_name");
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET a single employee's profile (Admin Only)
app.get('/api/employees/:uid', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT uid, email, role, status, full_name, phone_number, job_role, pay_rate FROM users WHERE uid = $1", [req.params.uid]);
        if (rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT to update an employee's profile (Admin Only)
app.put('/api/employees/:uid', authMiddleware, adminOnly, async (req, res) => {
    const { fullName, phoneNumber, jobRole, payRate, role, status } = req.body;
    const sql = `
        UPDATE users 
        SET full_name = $1, phone_number = $2, job_role = $3, pay_rate = $4, role = $5, status = $6
        WHERE uid = $7
        RETURNING *
    `;
    const params = [fullName, phoneNumber, jobRole, payRate, role, status, req.params.uid];
    try {
        const { rows } = await db.query(sql, params);
        if (rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
        logActivity(req.user, 'UPDATE_EMPLOYEE', `Updated profile for user UID: ${req.params.uid}`);
        res.status(200).json({ message: 'Employee profile updated successfully.', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// GET all availability entries for a given date range (for the rota view)
app.get('/api/availability/rota', authMiddleware, adminOnly, async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: "start_date and end_date are required." });
    }
    // This query finds any availability that overlaps with the week being viewed
    const sql = 'SELECT * FROM availability WHERE start_time < $2 AND end_time > $1';
    try {
        const { rows } = await db.query(sql, [start_date, end_date]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/availability/pending', authMiddleware, adminOnly, async (req, res) => {
    const sql = `SELECT a.*, u.full_name, u.email FROM availability a JOIN users u ON a.user_uid = u.uid WHERE a.status = 'pending' ORDER BY a.start_time ASC`;
    try {
        const { rows } = await db.query(sql);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/availability/:id/approve', authMiddleware, adminOnly, async (req, res) => {
    const sql = `UPDATE availability SET status = 'approved' WHERE id = $1 RETURNING *`;
    try {
        const { rows } = await db.query(sql, [req.params.id]);
        logActivity(req.user, 'APPROVE_AVAILABILITY', `Approved request ID: ${req.params.id}`);
        res.json({ message: 'Request approved.', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/availability/:id/reject', authMiddleware, adminOnly, async (req, res) => {
    const sql = `DELETE FROM availability WHERE id = $1`;
    try {
        await db.query(sql, [req.params.id]);
        logActivity(req.user, 'REJECT_AVAILABILITY', `Rejected request ID: ${req.params.id}`);
        res.json({ message: 'Request rejected and removed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rota/publish', authMiddleware, adminOnly, async (req, res) => {
    const { start_date, end_date } = req.body;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: "start_date and end_date are required." });
    }
    const sql = `UPDATE scheduled_shifts SET is_published = true WHERE shift_date BETWEEN $1 AND $2`;
    try {
        await db.query(sql, [start_date, end_date]);
        logActivity(req.user, 'PUBLISH_ROTA', `Published rota from ${start_date} to ${end_date}`);
        res.json({ message: `Rota from ${start_date} to ${end_date} has been published.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js

app.get('/api/rota', authMiddleware, adminOnly, async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: "start_date and end_date query parameters are required." });
    }
    const sql = `
        SELECT 
            ss.id, ss.shift_date, u.uid AS user_uid, u.full_name, u.job_role, 
            st.name AS shift_name, st.start_time, st.end_time, st.color_code 
        FROM scheduled_shifts ss 
        JOIN users u ON ss.user_uid = u.uid 
        JOIN shift_templates st ON ss.shift_template_id = st.id 
        WHERE ss.shift_date BETWEEN $1 AND $2 ORDER BY ss.shift_date, st.start_time;`;
    try {
        const { rows } = await db.query(sql, [start_date, end_date]);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// In server/index.js

app.post('/api/rota', authMiddleware, adminOnly, async (req, res) => {
    const { user_uid, shift_template_id, shift_date } = req.body;
    if (!user_uid || !shift_template_id || !shift_date) {
        return res.status(400).json({ error: "user_uid, shift_template_id, and shift_date are required." });
    }
    const sql = `INSERT INTO scheduled_shifts (user_uid, shift_template_id, shift_date) VALUES ($1, $2, $3) RETURNING *`;
    try {
        const { rows } = await db.query(sql, [user_uid, shift_template_id, shift_date]);
        logActivity(req.user, 'CREATE_SCHEDULE', `Scheduled user ${user_uid} for shift ${shift_template_id} on ${shift_date}`);
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Failed to schedule shift. The employee might already be scheduled for that day." });
    }
});

// In server/index.js

app.delete('/api/rota/:id', authMiddleware, adminOnly, async (req, res) => {
    const scheduledShiftId = req.params.id;
    const sql = `DELETE FROM scheduled_shifts WHERE id = $1`;
    try {
        const result = await db.query(sql, [scheduledShiftId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Scheduled shift not found.' });
        logActivity(req.user, 'DELETE_SCHEDULE', `Deleted scheduled shift ID: ${scheduledShiftId}`);
        res.status(200).json({ message: 'Scheduled shift deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



app.get('/api/time-entries', authMiddleware, adminOnly, async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: "start_date and end_date are required." });
    }
    
    // This SQL is now more robust for handling full-day ranges.
    // It finds all entries from the start of the start_date up to (but not including) the start of the day after the end_date.
    const sql = `
        SELECT te.*, u.full_name, u.email 
        FROM time_entries te 
        JOIN users u ON te.user_uid = u.uid 
        WHERE te.clock_in_timestamp >= $1 AND te.clock_in_timestamp < ($2::date + 1)
        ORDER BY te.clock_in_timestamp DESC
    `;
    try {
        const { rows } = await db.query(sql, [start_date, end_date]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In server/index.js

app.get('/api/reports/timesheet', authMiddleware, adminOnly, async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: "start_date and end_date are required." });
    }

    // This complex SQL query does the following:
    // 1. Joins users with their time entries.
    // 2. Filters for entries within the date range that have been approved.
    // 3. Groups the results by each employee.
    // 4. Calculates the SUM of hours worked and the SUM of their total pay (hours * pay_rate).
    const sql = `
        SELECT
            u.uid,
            u.full_name,
            u.email,
            u.pay_rate,
            COALESCE(SUM(te.actual_hours_worked), 0) AS total_hours,
            COALESCE(SUM(te.actual_hours_worked * u.pay_rate), 0) AS total_pay
        FROM users u
        LEFT JOIN time_entries te ON u.uid = te.user_uid
            AND te.clock_in_timestamp >= $1 
            AND te.clock_in_timestamp < ($2::date + 1)
            AND te.is_approved = true
        GROUP BY u.uid, u.full_name, u.email, u.pay_rate
        ORDER BY u.full_name;
    `;

    try {
        const { rows } = await db.query(sql, [start_date, end_date]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/timesheet/export', async (req, res) => {
    // This route needs a custom auth check because browsers can't send Auth headers for download links
    const { token, start_date, end_date } = req.query;

    if (!token) return res.status(401).send('Unauthorized: No token provided.');
    if (!start_date || !end_date) return res.status(400).json({ error: "start_date and end_date are required." });

    try {
        // Verify the token manually
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { rows: userRows } = await db.query("SELECT role FROM users WHERE uid = $1", [decodedToken.uid]);
        if (userRows.length === 0 || !userRows[0].role.includes('admin')) {
            return res.status(403).send('Forbidden: Admins only.');
        }

        const sql = `SELECT u.full_name, u.email, u.pay_rate, COALESCE(SUM(te.actual_hours_worked), 0) AS total_hours, COALESCE(SUM(te.actual_hours_worked * u.pay_rate), 0) AS total_pay FROM users u LEFT JOIN time_entries te ON u.uid = te.user_uid AND te.clock_in_timestamp >= $1 AND te.clock_in_timestamp < ($2::date + 1) AND te.is_approved = true GROUP BY u.uid, u.full_name, u.email, u.pay_rate ORDER BY u.full_name;`;
        const { rows } = await db.query(sql, [start_date, end_date]);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="payroll-summary-${start_date}-to-${end_date}.csv"`);
        
        let csvContent = "Employee,Email,Pay Rate,Total Hours,Total Pay\n";
        rows.forEach(row => {
            csvContent += `${row.full_name || ''},${row.email},${row.pay_rate},${parseFloat(row.total_hours).toFixed(2)},${parseFloat(row.total_pay).toFixed(2)}\n`;
        });

        res.status(200).end(csvContent);

    } catch (err) {
        res.status(500).send("Failed to generate report.");
    }
});

// GET a report comparing labor cost to sales for a given day
app.get('/api/reports/labor-vs-sales', authMiddleware, adminOnly, async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ error: "A 'date' query parameter is required." });
    }

    try {
        // Promise.all to run both calculations simultaneously
        const [salesResult, laborResult] = await Promise.all([
            // 1. Calculate total sales for the given day
            db.query("SELECT SUM(amount) AS total FROM transactions WHERE type = 'sale' AND DATE(transaction_date) = $1", [date]),
            
            // 2. Calculate total projected labor cost for the given day
            db.query(`
                SELECT SUM(
                    EXTRACT(EPOCH FROM (st.end_time - st.start_time)) / 3600 * u.pay_rate
                ) AS total
                FROM scheduled_shifts ss
                JOIN users u ON ss.user_uid = u.uid
                JOIN shift_templates st ON ss.shift_template_id = st.id
                WHERE ss.shift_date = $1
            `, [date])
        ]);

        const totalSales = parseFloat(salesResult.rows[0].total || 0);
        const totalLaborCost = parseFloat(laborResult.rows[0].total || 0);
        
        // Calculate labor cost as a percentage of sales
        const laborCostPercentage = totalSales > 0 ? (totalLaborCost / totalSales) * 100 : 0;

        res.json({
            data: {
                date,
                totalSales,
                totalLaborCost,
                laborCostPercentage
            }
        });

    } catch (err) {
        res.status(500).json({ error: "Failed to generate labor vs. sales report." });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
