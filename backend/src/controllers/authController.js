const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const signup = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const newUser = await pool.query(
      "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at",
      [username, email, hashedPassword, role || 'Member']
    );

    const user = newUser.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Error in signup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find the user by email
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at, last_active FROM users ORDER BY username ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // Return 200 even if user not found to prevent email enumeration
      return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    // Expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [resetTokenHash, expiresAt, email]
    );

    // In a real app, send email here. For now, we simulate it.
    console.log(`[SIMULATED EMAIL] Password reset link: http://localhost:5173/reset-password/${resetToken}?email=${encodeURIComponent(email)}`);

    res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = userResult.rows[0];

    if (!user.reset_token || !user.reset_token_expires || new Date() > user.reset_token_expires) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const isValidToken = await bcrypt.compare(token, user.reset_token);
    if (!isValidToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE email = $2',
      [hashedPassword, email]
    );

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error in reset password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  signup,
  login,
  getUsers,
  forgotPassword,
  resetPassword
};
