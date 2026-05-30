const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { pool } = require('./config/db');

// Startup migration: safely add any missing columns to the live DB
async function runMigrations() {
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'light',
        ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "task_assigned": true, "status_change": true, "mentions": true}'::jsonb,
        ADD COLUMN IF NOT EXISTS display_options JSONB DEFAULT '{"compact_view": false, "show_completed": true, "items_per_page": 20}'::jsonb;
    `);
    console.log('✅ DB migrations applied successfully');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
}

runMigrations();

// Import routes
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const profileRoutes = require('./routes/profileRoutes');
const searchRoutes = require('./routes/searchRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const collaborationRoutes = require('./routes/collaborationRoutes');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/collaboration', collaborationRoutes);



// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Catch-all route to serve React app for non-API requests
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
