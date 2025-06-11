// server/database.js
const { Pool } = require('pg');
require('dotenv').config();

// The pool will use the DATABASE_URL from your .env file to connect
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true,
    },
});

// This function creates all of our tables if they don't already exist
const createTables = async () => {
    const client = await pool.connect();
    try {
        console.log('Connected to the PostgreSQL database, checking tables...');
        
        // Use SERIAL PRIMARY KEY for auto-incrementing IDs in PostgreSQL
        // Use TIMESTAMPTZ for timestamps with time zones
        await client.query(`
            CREATE TABLE IF NOT EXISTS Users (
                uid TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL DEFAULT 'staff',
                status TEXT NOT NULL DEFAULT 'active'
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS Transactions (
                id SERIAL PRIMARY KEY,
                user_uid TEXT NOT NULL REFERENCES Users(uid),
                description TEXT NOT NULL,
                amount NUMERIC(10, 2) NOT NULL,
                type TEXT NOT NULL DEFAULT 'expense',
                status TEXT NOT NULL DEFAULT 'approved',
                transaction_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS Activity_Logs (
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

// We now export an object with a 'query' method for running queries
// and the 'createTables' function to be run at server start.
module.exports = {
    query: (text, params) => pool.query(text, params),
    createTables,
};