require('dotenv').config();
const { Client } = require('pg');

async function migrate() {
  const client = process.env.DATABASE_URL 
    ? new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'team_task_manager',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
      });

  try {
    await client.connect();
    console.log('Connected to db');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'light',
      ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "task_assigned": true, "status_change": true, "mentions": true}'::jsonb,
      ADD COLUMN IF NOT EXISTS display_options JSONB DEFAULT '{"compact_view": false, "show_completed": true, "items_per_page": 20}'::jsonb;
    `);
    console.log('Migration successful');
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
migrate();
