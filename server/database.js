// server/database.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true,
    },
    // --- NEW CONFIGURATION TO PREVENT TIMEOUTS ---
    keepAlive: true, // Sends a "keep-alive" signal to prevent the connection from being flagged as idle
    idleTimeoutMillis: 30000, // Closes idle clients in the pool after 30 seconds
    connectionTimeoutMillis: 5000, // Returns an error after 5 seconds if a connection cannot be established
});

const createTables = async () => {
    const client = await pool.connect();
    try {
        console.log('Connected to the PostgreSQL database, checking tables...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                uid TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL DEFAULT 'staff',
                status TEXT NOT NULL DEFAULT 'active'
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_uid TEXT NOT NULL REFERENCES users(uid),
                description TEXT NOT NULL,
                amount NUMERIC(10, 2) NOT NULL,
                type TEXT NOT NULL,
                category TEXT, -- This was the missing column
                status TEXT NOT NULL DEFAULT 'approved',
                transaction_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_uid TEXT NOT NULL,
                user_email TEXT NOT NULL,
                action_type TEXT NOT NULL,
                details TEXT,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Tables are successfully created or already exist.');
    } catch (err) {
        console.error('Error creating tables:', err.stack);
    } finally {
        client.release();
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    createTables,
};