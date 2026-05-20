const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Get user profile
 * Returns user profile information (excluding password)
 */
const getUserProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT id, username, email, role, avatar, created_at 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update user profile
 * Allows updating username, email, and password with validation
 */
const updateUserProfile = async (req, res) => {
  const userId = req.user.id;
  const { username, email, currentPassword, newPassword } = req.body;

  try {
    // Validate input
    if (!username && !email && !newPassword) {
      return res.status(400).json({ error: 'At least one field must be provided for update' });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    // Validate username length if provided
    if (username) {
      if (username.length < 3 || username.length > 50) {
        return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
      }
    }

    // Check if username or email already exists (excluding current user)
    if (username || email) {
      const checkQuery = [];
      const checkParams = [];
      let paramIndex = 1;

      if (username) {
        checkQuery.push(`username = $${paramIndex}`);
        checkParams.push(username);
        paramIndex++;
      }

      if (email) {
        checkQuery.push(`email = $${paramIndex}`);
        checkParams.push(email);
        paramIndex++;
      }

      checkParams.push(userId);

      const existingUser = await pool.query(
        `SELECT id FROM users WHERE (${checkQuery.join(' OR ')}) AND id != $${paramIndex}`,
        checkParams
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }
    }

    // Handle password update
    let hashedPassword = null;
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }

      // Validate new password strength
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      // Verify current password
      const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(newPassword, salt);
    }

    // Build update query dynamically
    const updateFields = [];
    const updateParams = [];
    let paramIndex = 1;

    if (username) {
      updateFields.push(`username = $${paramIndex}`);
      updateParams.push(username);
      paramIndex++;
    }

    if (email) {
      updateFields.push(`email = $${paramIndex}`);
      updateParams.push(email);
      paramIndex++;
    }

    if (hashedPassword) {
      updateFields.push(`password = $${paramIndex}`);
      updateParams.push(hashedPassword);
      paramIndex++;
    }

    updateParams.push(userId);

    const result = await pool.query(
      `UPDATE users 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING id, username, email, role, avatar, created_at`,
      updateParams
    );

    res.status(200).json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upload user avatar
 * Validates file type and size, stores avatar URL
 * Note: This is a simplified implementation that stores base64 data or URL
 * In production, you would typically use a file storage service like AWS S3
 */
const uploadAvatar = async (req, res) => {
  const userId = req.user.id;
  const { avatar } = req.body;

  try {
    // Validate avatar data
    if (!avatar) {
      return res.status(400).json({ error: 'Avatar data is required' });
    }

    // Validate avatar format (base64 or URL)
    const isBase64 = avatar.startsWith('data:image/');
    const isUrl = avatar.startsWith('http://') || avatar.startsWith('https://');

    if (!isBase64 && !isUrl) {
      return res.status(400).json({ error: 'Invalid avatar format. Must be base64 data or URL' });
    }

    // Validate base64 image type
    if (isBase64) {
      const validImageTypes = ['data:image/jpeg', 'data:image/jpg', 'data:image/png', 'data:image/gif', 'data:image/webp'];
      const isValidType = validImageTypes.some(type => avatar.startsWith(type));
      
      if (!isValidType) {
        return res.status(400).json({ error: 'Invalid image type. Allowed types: JPEG, PNG, GIF, WebP' });
      }

      // Validate base64 size (limit to ~2MB)
      const base64Length = avatar.length - avatar.indexOf(',') - 1;
      const sizeInBytes = (base64Length * 3) / 4;
      const maxSizeInBytes = 2 * 1024 * 1024; // 2MB

      if (sizeInBytes > maxSizeInBytes) {
        return res.status(400).json({ error: 'Avatar size exceeds 2MB limit' });
      }
    }

    // Update user avatar
    const result = await pool.query(
      `UPDATE users 
       SET avatar = $1 
       WHERE id = $2 
       RETURNING id, username, email, role, avatar, created_at`,
      [avatar, userId]
    );

    res.status(200).json({
      message: 'Avatar uploaded successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  uploadAvatar
};
