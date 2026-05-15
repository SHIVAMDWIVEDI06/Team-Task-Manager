require('dotenv').config();
const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database for migration.');
    
    await client.query('ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL;');
    console.log('Added password column to users table.');
  } catch (err) {
    if (err.code === '42701') { // column "password" of relation "users" already exists
      console.log('Password column already exists.');
    } else {
      console.error('Migration error:', err);
    }
  } finally {
    await client.end();
  }
}

migrate();
