const { pool } = require('../config/db');

/**
 * Create a new notification
 * @param {number} userId - The user ID to notify
 * @param {string} type - Notification type (task_assigned, status_change, mention)
 * @param {string} message - Notification message
 * @param {number|null} relatedId - Related entity ID (task_id, project_id, etc.)
 * @returns {Promise<object>} Created notification
 */
const createNotification = async (userId, type, message, relatedId = null) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, message, related_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, type, message, relatedId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Get notifications for a user with pagination
 */
const getNotifications = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, unread_only = false } = req.query;
  const offset = (page - 1) * limit;

  try {
    let countQuery = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1';
    let dataQuery = 'SELECT * FROM notifications WHERE user_id = $1';
    const queryParams = [userId];

    if (unread_only === 'true') {
      countQuery += ' AND is_read = false';
      dataQuery += ' AND is_read = false';
    }

    // Get total count
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated notifications
    dataQuery += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    queryParams.push(limit, offset);
    
    const notificationsResult = await pool.query(dataQuery, queryParams);

    // Get unread count
    const unreadResult = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    const unreadCount = parseInt(unreadResult.rows[0].count);

    res.status(200).json({
      notifications: notificationsResult.rows,
      total,
      unreadCount,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Mark a notification as read
 */
const markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Verify the notification belongs to the user
    const notificationResult = await pool.query(
      'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (notificationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1',
      [id]
    );

    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Archive notifications older than 30 days
 */
const archiveOldNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE user_id = $1 
       AND is_read = false 
       AND created_at < NOW() - INTERVAL '30 days'
       RETURNING *`,
      [userId]
    );

    res.status(200).json({ 
      message: 'Old notifications archived',
      archivedCount: result.rowCount 
    });
  } catch (error) {
    console.error('Error archiving old notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a notification
 */
const deleteNotification = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  archiveOldNotifications,
  deleteNotification
};