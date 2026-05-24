require('dotenv').config();
const { pool } = require('./config/db');

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Connected to database for invitations migration.');
    
    // Create Invitations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        invited_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'Pending',
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Invitations table created.');

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
