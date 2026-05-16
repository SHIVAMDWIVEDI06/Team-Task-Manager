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

app.use(cors());
app.use(express.json());

// Mount API routes FIRST (before static files and catch-all)
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
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
