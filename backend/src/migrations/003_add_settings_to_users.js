const { pool } = require('../config/db');

/**
 * Migration: Add settings columns to users table
 * This migration adds theme, notification_preferences, and display_options fields
 * for user application settings
 */
async function up() {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'light',
      ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "task_assigned": true, "status_change": true, "mentions": true}'::jsonb,
      ADD COLUMN IF NOT EXISTS display_options JSONB DEFAULT '{"compact_view": false, "show_completed": true, "items_per_page": 20}'::jsonb;
    `);
    console.log('Migration 003: Added settings columns to users table');
  } catch (error) {
    console.error('Error in migration 003 (up):', error);
    throw error;
  }
}

/**
 * Rollback migration
 */
async function down() {
  try {
    await pool.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS theme,
      DROP COLUMN IF EXISTS notification_preferences,
      DROP COLUMN IF EXISTS display_options;
    `);
    console.log('Migration 003: Removed settings columns from users table');
  } catch (error) {
    console.error('Error in migration 003 (down):', error);
    throw error;
  }
}

module.exports = { up, down };
