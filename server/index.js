// server/index.js
require('dotenv').config(); // Reads the .env file from the server folder
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const db = require('./database.js');

// This function will run once when the server starts to set up the database.
db.createTables();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const PORT = 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// --- HELPER FUNCTIONS and MIDDLEWARES ---

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Unauthorized: No token provided.');
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const sql = "SELECT * FROM Users WHERE uid = $1";
        const { rows } = await db.query(sql, [decodedToken.uid]);
        
        if (rows.length === 0) {
            const insertSql = "INSERT INTO Users (uid, email, role, status) VALUES ($1, $2, 'staff', 'active')";
            await db.query(insertSql, [decodedToken.uid, decodedToken.email]);
            req.user = { ...decodedToken, role: 'staff', status: 'active' };
            return next();
        }

        const user = rows[0];
        if (user.status === 'inactive') {
            return res.status(403).send('Forbidden: Your account has been disabled.');
        }
        req.user = { ...decodedToken, role: user.role, status: user.status };
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(403).send('Unauthorized: Invalid token.');
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
    const sql = `INSERT INTO Activity_Logs (user_uid, user_email, action_type, details) VALUES ($1, $2, $3, $4)`;
    try {
        await db.query(sql, [user.uid, user.email, action_type, details]);
    } catch (err) {
        console.error("Failed to log activity:", err.message);
    }
};

// --- API ROUTES ---

// General User Route
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email, role: req.user.role, status: req.user.status });
});

// Transaction Routes for All Users
app.get('/api/transactions', authMiddleware, async (req, res) => {
    const { date } = req.query;
    const user_uid = req.user.uid;
    let sql = `SELECT * FROM Transactions WHERE user_uid = $1`;
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
  // Look for description, amount, AND an optional transaction_date
  const { description, amount, transaction_date } = req.body;

  // If a date is provided by the client, use it. Otherwise, default to now.
  const dateToInsert = transaction_date ? new Date(transaction_date) : new Date();

  const sql = 'INSERT INTO Transactions (user_uid, description, amount, transaction_date) VALUES ($1, $2, $3, $4) RETURNING *';
  const params = [req.user.uid, description, amount, dateToInsert];

  try {
    const { rows } = await db.query(sql, params);
    logActivity(req.user, 'CREATE_EXPENSE', `Description: ${description}, Amount: ${amount}, Date: ${dateToInsert.toISOString().split('T')[0]}`);
    res.status(201).json({ message: "success", data: rows[0] });
  } catch (err) {
    res.status(400).json({"error": err.message});
  }
});

app.post('/api/transactions/:id/request-delete', authMiddleware, async (req, res) => {
    const transactionId = req.params.id;
    const sql = "UPDATE Transactions SET status = 'pending_delete' WHERE id = $1 AND user_uid = $2";
    try {
        const result = await db.query(sql, [transactionId, req.user.uid]);
        if (result.rowCount === 0) return res.status(404).json({ "error": "Transaction not found or user not authorized." });
        logActivity(req.user, 'REQUEST_DELETION', `Transaction ID: ${transactionId}`);
        res.json({ message: "Deletion request submitted for approval." });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});


// --- ADMIN ONLY ROUTES ---

app.get('/api/transactions/all', authMiddleware, adminOnly, async (req, res) => {
    const { date } = req.query;
    let sql = `
        SELECT t.*, u.email AS user_email 
        FROM Transactions t JOIN Users u ON t.user_uid = u.uid`;
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
    const sql = `SELECT t.*, u.email AS user_email FROM Transactions t JOIN Users u ON t.user_uid = u.uid WHERE t.status = 'pending_delete' ORDER BY t.transaction_date ASC`;
    try {
        const { rows } = await db.query(sql);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/:id/approve-delete', authMiddleware, adminOnly, async (req, res) => {
    const transactionId = req.params.id;
    const sql = "DELETE FROM Transactions WHERE id = $1";
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
    const sql = "UPDATE Transactions SET status = 'approved' WHERE id = $1";
    try {
        await db.query(sql, [transactionId]);
        logActivity(req.user, 'REJECT_DELETION', `Transaction ID: ${transactionId}`);
        res.json({ message: "Deletion rejected. Transaction restored." });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.delete('/api/transactions/:id', authMiddleware, adminOnly, async (req, res) => {
    const transactionId = req.params.id;
    const sql = "DELETE FROM Transactions WHERE id = $1";
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

app.get('/api/dashboard/summary', authMiddleware, adminOnly, async (req, res) => {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const yesterday = new Date(targetDate);
    yesterday.setDate(targetDate.getDate() - 1);
    const targetDateString = targetDate.toISOString().split('T')[0];
    const yesterdayString = yesterday.toISOString().split('T')[0];

    try {
        const todaySql = "SELECT SUM(amount) AS total FROM Transactions WHERE type = 'expense' AND DATE(transaction_date) = $1";
        const todayResult = await db.query(todaySql, [targetDateString]);
        const todaysExpenses = todayResult.rows[0].total || 0;

        const yesterdaySql = "SELECT SUM(amount) AS total FROM Transactions WHERE type = 'expense' AND DATE(transaction_date) = $1";
        const yesterdayResult = await db.query(yesterdaySql, [yesterdayString]);
        const yesterdaysExpenses = yesterdayResult.rows[0].total || 0;

        res.json({ data: { todaysExpenses: parseFloat(todaysExpenses), yesterdaysExpenses: parseFloat(yesterdaysExpenses) } });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch dashboard summary." });
    }
});

app.get('/api/users', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT uid, email, role, status FROM Users");
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const userRecord = await admin.auth().createUser({ email, password });
        const sql = "INSERT INTO Users (uid, email, role, status) VALUES ($1, $2, $3, 'active') RETURNING *";
        const { rows } = await db.query(sql, [userRecord.uid, email, role]);
        logActivity(req.user, 'CREATE_USER', `New user: ${email}, Role: ${role}`);
        res.status(201).json({ message: "User created successfully", data: rows[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// PUT to update an existing transaction (Admins Only)
app.put('/api/transactions/:id', authMiddleware, adminOnly, async (req, res) => {
    const transactionId = req.params.id;
    const { description, amount, transaction_date } = req.body;

    // Basic validation
    if (!description || !amount || !transaction_date) {
        return res.status(400).json({ error: "All fields are required." });
    }

    const sql = `
        UPDATE Transactions 
        SET description = $1, amount = $2, transaction_date = $3 
        WHERE id = $4 
        RETURNING *
    `;
    const params = [description, amount, transaction_date, transactionId];

    try {
        const { rows } = await db.query(sql, params);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Transaction not found." });
        }
        logActivity(req.user, 'UPDATE_TRANSACTION', `Updated Transaction ID: ${transactionId}`);
        res.status(200).json({ message: "Transaction updated successfully", data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Failed to update transaction." });
    }
});

app.delete('/api/users/:uid', authMiddleware, adminOnly, async (req, res) => {
    const userUidToDisable = req.params.uid;
    if (req.user.uid === userUidToDisable) {
        return res.status(400).json({ error: "Admins cannot disable their own account." });
    }
    try {
        await admin.auth().updateUser(userUidToDisable, { disabled: true });
        const sql = `UPDATE Users SET status = 'inactive' WHERE uid = $1`;
        await db.query(sql, [userUidToDisable]);
        logActivity(req.user, 'DISABLE_USER', `Disabled user with UID: ${userUidToDisable}`);
        res.status(200).json({ message: `Successfully disabled user. Their data has been preserved.` });
    } catch (error) {
        res.status(500).json({ error: "Failed to disable user." });
    }
});

app.get('/api/activity-logs', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM Activity_Logs ORDER BY timestamp DESC");
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Note: This is a development-only route and should be removed before a real deployment.
app.post('/api/users/make-admin', authMiddleware, async (req, res) => {
    const sql = "UPDATE Users SET role = 'primary_admin' WHERE uid = $1";
    try {
        await db.query(sql, [req.user.uid]);
        logActivity(req.user, 'PROMOTE_ADMIN', `Promoted user: ${req.user.email}`);
        res.json({ message: `User ${req.user.email} has been promoted to Primary Admin.`});
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});