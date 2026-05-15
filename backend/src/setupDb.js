require('dotenv').config();
const { Client } = require('pg');

async function setup() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const targetClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await targetClient.connect();
    console.log(`Connected to database.`);

    const schemaQuery = `
      -- Users Table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'Member',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Projects Table
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Project Members Table
      CREATE TABLE IF NOT EXISTS project_members (
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (project_id, user_id)
      );

      -- Tasks Table
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'To Do',
        priority VARCHAR(20) DEFAULT 'Medium',
        due_date DATE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await targetClient.query(schemaQuery);
    console.log('Full schema created or verified successfully.');

  } catch (err) {
    console.error('Error during schema setup:', err);
    process.exit(1);
  } finally {
    await targetClient.end();
  }
}

setup();
