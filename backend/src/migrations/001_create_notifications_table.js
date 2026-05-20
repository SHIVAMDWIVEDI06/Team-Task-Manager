require('dotenv').config();
const { Client } = require('pg');

/**
 * Migration: Create notifications table
 * 
 * This migration creates the notifications table with the following fields:
 * - id: Primary key
 * - user_id: Foreign key to users table
 * - type: Notification type (task_assigned, status_change, mention, etc.)
 * - message: Notification message text
 * - related_id: Optional foreign key to related entity (task, project, etc.)
 * - is_read: Boolean flag for read status
 * - created_at: Timestamp of notification creation
 * 
 * Indexes are added for:
 * - user_id: For efficient user notification queries
 * - created_at: For efficient time-based queries and archiving
 * - user_id + is_read: For efficient unread notification queries
 */
async function up() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Connected to database for notifications table migration.');

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        related_id INTEGER,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Created notifications table');

    // Create index on user_id for efficient user notification queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
      ON notifications(user_id);
    `);
    console.log('✓ Created index on user_id');

    // Create index on created_at for efficient time-based queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
      ON notifications(created_at);
    `);
    console.log('✓ Created index on created_at');

    // Create composite index on user_id and is_read for efficient unread queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read 
      ON notifications(user_id, is_read);
    `);
    console.log('✓ Created composite index on user_id and is_read');

    console.log('✅ Notifications table migration completed successfully');
  } catch (err) {
    if (err.code === '42P07') {
      // Table already exists
      console.log('⚠ Notifications table already exists, skipping creation');
    } else {
      console.error('❌ Migration error:', err);
      throw err;
    }
  } finally {
    await client.end();
  }
}

/**
 * Rollback migration: Drop notifications table
 */
async function down() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Connected to database for notifications table rollback.');

    // Drop indexes first
    await client.query('DROP INDEX IF EXISTS idx_notifications_user_id_is_read;');
    await client.query('DROP INDEX IF EXISTS idx_notifications_created_at;');
    await client.query('DROP INDEX IF EXISTS idx_notifications_user_id;');
    console.log('✓ Dropped indexes');

    // Drop table
    await client.query('DROP TABLE IF EXISTS notifications;');
    console.log('✓ Dropped notifications table');

    console.log('✅ Notifications table rollback completed successfully');
  } catch (err) {
    console.error('❌ Rollback error:', err);
    throw err;
  } finally {
    await client.end();
  }
}

// Run migration if executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'down') {
    down()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    up()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = { up, down };
