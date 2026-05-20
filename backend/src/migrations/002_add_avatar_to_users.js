const { pool } = require('../config/db');

/**
 * Migration: Add avatar column to users table
 * This migration adds an avatar field to store user profile pictures
 */
async function up() {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS avatar TEXT;
    `);
    console.log('Migration 002: Added avatar column to users table');
  } catch (error) {
    console.error('Error in migration 002 (up):', error);
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
      DROP COLUMN IF EXISTS avatar;
    `);
    console.log('Migration 002: Removed avatar column from users table');
  } catch (error) {
    console.error('Error in migration 002 (down):', error);
    throw error;
  }
}

module.exports = { up, down };
