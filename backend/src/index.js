const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { pool } = require('./config/db');

const app = express();
const port = process.env.PORT || 5000;

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const searchRoutes = require('./routes/searchRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');

// Initialize database tables on startup
async function initializeDatabase() {
  try {
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
    
    await pool.query(schemaQuery);
    console.log('✅ Database tables initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing database:', err);
  }
}

// Initialize database before starting server
initializeDatabase();

app.use(cors());
app.use(express.json());

// Mount API routes FIRST (before static files and catch-all)
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/statistics', statisticsRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// Database initialization endpoint (for Railway deployment)
app.post('/api/init-db', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Delete dash users
    await pool.query("DELETE FROM users WHERE username LIKE 'dash-%'");

    const users = [
      { username: 'admin', email: 'admin@test.com', role: 'Admin' },
      { username: 'pawan', email: 'pawan@test.com', role: 'Admin' },
      { username: 'madhwan', email: 'madhwan@test.com', role: 'Admin' },
      { username: 'shreya', email: 'shreya@test.com', role: 'Member' },
      { username: 'kirti', email: 'kirti@test.com', role: 'Member' },
      { username: 'kritika', email: 'kritika@test.com', role: 'Member' },
      { username: 'saksham', email: 'saksham@test.com', role: 'Member' },
      { username: 'sejal', email: 'sejal@test.com', role: 'Member' },
      { username: 'gursimar', email: 'gursimar@test.com', role: 'Member' },
      { username: 'yash', email: 'yash@test.com', role: 'Member' }
    ];

    let created = 0;
    let updated = 0;

    for (const user of users) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [user.email, user.username]
      );

      if (existing.rows.length > 0) {
        await pool.query(
          'UPDATE users SET username = $1, email = $2, password = $3, role = $4 WHERE id = $5',
          [user.username, user.email, hashedPassword, user.role, existing.rows[0].id]
        );
        updated++;
      } else {
        await pool.query(
          'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
          [user.username, user.email, hashedPassword, user.role]
        );
        created++;
      }
    }

    res.json({
      success: true,
      message: 'Database initialized successfully',
      created,
      updated,
      credentials: {
        admin: 'admin@test.com / password123',
        users: 'All users have password: password123'
      }
    });
  } catch (err) {
    console.error('Init DB error:', err);
    res.status(500).json({ error: 'Failed to initialize database', details: err.message });
  }
});

// Serve frontend static files from React production build (AFTER API routes)
const frontendPath = path.join(__dirname, '../../frontend/dist');
console.log('Serving static files from:', frontendPath);
app.use(express.static(frontendPath));

// Serve React app for any unknown routes (SPA support) - MUST BE LAST
// Note: Express 5 requires a different syntax for catch-all routes
app.use((req, res) => {
  const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
