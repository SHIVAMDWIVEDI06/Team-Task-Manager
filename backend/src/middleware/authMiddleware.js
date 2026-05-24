const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const authMiddleware = async (req, res, next) => {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if no header or doesn't start with Bearer
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided, authorization denied' });
  }

  // Extract the token
  const token = authHeader.split(' ')[1];

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user payload to request object
    req.user = decoded;

    // Update last_active in background
    pool.query('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [decoded.id]).catch(err => console.error('Failed to update last_active', err));

    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin privileges required' });
  }
};

authMiddleware.isAdmin = isAdmin;
module.exports = authMiddleware;
