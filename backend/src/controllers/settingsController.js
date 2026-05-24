const { pool } = require('../config/db');

/**
 * Get user settings
 * Returns user settings including theme, notification preferences, and display options
 */
const getUserSettings = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT theme, notification_preferences, display_options 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update user settings
 * Allows updating theme, notification preferences, and display options
 */
const updateUserSettings = async (req, res) => {
  const userId = req.user.id;
  const { theme, notification_preferences, display_options } = req.body;

  try {
    // Validate input - at least one field must be provided
    if (!theme && !notification_preferences && !display_options) {
      return res.status(400).json({ error: 'At least one setting field must be provided for update' });
    }

    // Validate theme value if provided
    if (theme) {
      const validThemes = ['light', 'dark', 'auto'];
      if (!validThemes.includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme value. Must be one of: light, dark, auto' });
      }
    }

    // Validate notification_preferences structure if provided
    if (notification_preferences) {
      if (typeof notification_preferences !== 'object' || Array.isArray(notification_preferences)) {
        return res.status(400).json({ error: 'notification_preferences must be an object' });
      }

      // Validate boolean fields if they exist
      const booleanFields = ['email', 'push', 'task_assigned', 'status_change', 'mentions'];
      for (const field of booleanFields) {
        if (notification_preferences.hasOwnProperty(field) && typeof notification_preferences[field] !== 'boolean') {
          return res.status(400).json({ error: `notification_preferences.${field} must be a boolean` });
        }
      }
    }

    // Validate display_options structure if provided
    if (display_options) {
      if (typeof display_options !== 'object' || Array.isArray(display_options)) {
        return res.status(400).json({ error: 'display_options must be an object' });
      }

      // Validate specific fields if they exist
      if (display_options.hasOwnProperty('compact_view') && typeof display_options.compact_view !== 'boolean') {
        return res.status(400).json({ error: 'display_options.compact_view must be a boolean' });
      }

      if (display_options.hasOwnProperty('show_completed') && typeof display_options.show_completed !== 'boolean') {
        return res.status(400).json({ error: 'display_options.show_completed must be a boolean' });
      }

      if (display_options.hasOwnProperty('items_per_page')) {
        const itemsPerPage = display_options.items_per_page;
        if (!Number.isInteger(itemsPerPage) || itemsPerPage < 10 || itemsPerPage > 100) {
          return res.status(400).json({ error: 'display_options.items_per_page must be an integer between 10 and 100' });
        }
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateParams = [];
    let paramIndex = 1;

    if (theme) {
      updateFields.push(`theme = $${paramIndex}`);
      updateParams.push(theme);
      paramIndex++;
    }

    if (notification_preferences) {
      updateFields.push(`notification_preferences = $${paramIndex}`);
      updateParams.push(JSON.stringify(notification_preferences));
      paramIndex++;
    }

    if (display_options) {
      updateFields.push(`display_options = $${paramIndex}`);
      updateParams.push(JSON.stringify(display_options));
      paramIndex++;
    }

    updateParams.push(userId);

    const result = await pool.query(
      `UPDATE users 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING theme, notification_preferences, display_options`,
      updateParams
    );

    res.status(200).json({
      message: 'Settings updated successfully',
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getUserSettings,
  updateUserSettings
};
