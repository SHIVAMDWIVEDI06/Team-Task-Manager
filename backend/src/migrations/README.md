# Database Migrations

This directory contains database migration scripts for the Team Task Manager application.

## Available Migrations

### 001_create_notifications_table.js

Creates the notifications table with the following structure:

**Fields:**
- `id` (SERIAL PRIMARY KEY): Unique notification identifier
- `user_id` (INTEGER NOT NULL): Foreign key to users table
- `type` (VARCHAR(50) NOT NULL): Notification type (e.g., task_assigned, status_change, mention)
- `message` (TEXT NOT NULL): Notification message content
- `related_id` (INTEGER): Optional foreign key to related entity (task, project, etc.)
- `is_read` (BOOLEAN DEFAULT false): Read status flag
- `created_at` (TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP): Creation timestamp

**Indexes:**
- `idx_notifications_user_id`: Index on user_id for efficient user notification queries
- `idx_notifications_created_at`: Index on created_at for time-based queries and archiving
- `idx_notifications_user_id_is_read`: Composite index for efficient unread notification queries

**Constraints:**
- Foreign key constraint on user_id referencing users(id) with CASCADE delete

## Running Migrations

### Apply Migration (Up)

```bash
# From the backend directory
node src/migrations/001_create_notifications_table.js
```

### Rollback Migration (Down)

```bash
# From the backend directory
node src/migrations/001_create_notifications_table.js down
```

### Verify Migration

```bash
# From the backend directory
node src/migrations/verify_notifications_table.js
```

## Requirements Satisfied

This migration satisfies the following requirements from the UI/UX Enhancement spec:

- **Requirement 2.1**: Support for creating notifications when users are assigned tasks
- **Requirement 2.2**: Support for creating notifications when task status changes
- **Requirement 2.7**: Support for archiving notifications older than 30 days

## Notes

- The migration script is idempotent - it can be run multiple times safely
- The script uses `CREATE TABLE IF NOT EXISTS` to avoid errors if the table already exists
- All indexes use `CREATE INDEX IF NOT EXISTS` for safe re-runs
- The migration includes both `up()` and `down()` functions for forward and rollback operations
- The user_id foreign key has ON DELETE CASCADE to automatically clean up notifications when users are deleted
