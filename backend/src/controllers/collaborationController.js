const { pool } = require('../config/db');

// --- COMMENTS & MENTIONS ---

const getComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await pool.query(`
      SELECT c.*, u.username, u.avatar 
      FROM comments c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.task_id = $1 
      ORDER BY c.created_at ASC
    `, [taskId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const addComment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { taskId } = req.params;
    const { content, projectId } = req.body;
    const userId = req.user.userId;

    // 1. Insert comment
    const commentResult = await client.query(
      'INSERT INTO comments (task_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [taskId, userId, content]
    );
    const newComment = commentResult.rows[0];

    // Fetch user details for the response and activity log
    const userResult = await client.query('SELECT username, avatar FROM users WHERE id = $1', [userId]);
    const { username, avatar } = userResult.rows[0];
    newComment.username = username;
    newComment.avatar = avatar;

    // 2. Parse Mentions (@username)
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = [...content.matchAll(mentionRegex)].map(m => m[1]);
    
    if (mentions.length > 0) {
      // Find mentioned users
      const mentionedUsers = await client.query(
        'SELECT id, username FROM users WHERE username = ANY($1)',
        [mentions]
      );
      
      // Create notifications for mentioned users
      for (const mUser of mentionedUsers.rows) {
        if (mUser.id !== userId) {
          await client.query(
            'INSERT INTO notifications (user_id, type, message, related_id) VALUES ($1, $2, $3, $4)',
            [mUser.id, 'mention', `${username} mentioned you in a comment`, taskId]
          );
        }
      }
    }

    // 3. Log Activity
    if (projectId) {
      await client.query(
        'INSERT INTO activity_feed (project_id, user_id, action_type, metadata) VALUES ($1, $2, $3, $4)',
        [projectId, userId, 'comment_added', JSON.stringify({ task_id: taskId, comment_id: newComment.id })]
      );

      // 4. Notify Subscribers
      const subscribers = await client.query(
        'SELECT user_id FROM project_subscriptions WHERE project_id = $1 AND user_id != $2',
        [projectId, userId]
      );
      
      for (const sub of subscribers.rows) {
        // Avoid duplicate notification if they were already mentioned
        const wasMentioned = mentions.length > 0 && 
          (await client.query('SELECT id FROM users WHERE id = $1 AND username = ANY($2)', [sub.user_id, mentions])).rows.length > 0;
          
        if (!wasMentioned) {
          await client.query(
            'INSERT INTO notifications (user_id, type, message, related_id) VALUES ($1, $2, $3, $4)',
            [sub.user_id, 'project_activity', `${username} commented on a task`, taskId]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json(newComment);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// --- ACTIVITY FEED ---

const getActivityFeed = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await pool.query(`
      SELECT a.*, u.username, u.avatar 
      FROM activity_feed a 
      LEFT JOIN users u ON a.user_id = u.id 
      WHERE a.project_id = $1 
      ORDER BY a.created_at DESC 
      LIMIT 50
    `, [projectId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- SUBSCRIPTIONS ---

const checkSubscription = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId;
    const result = await pool.query(
      'SELECT 1 FROM project_subscriptions WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
    res.json({ isSubscribed: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const toggleSubscription = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId;
    
    const existing = await pool.query(
      'SELECT 1 FROM project_subscriptions WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'DELETE FROM project_subscriptions WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );
      res.json({ isSubscribed: false, message: 'Unsubscribed from project' });
    } else {
      await pool.query(
        'INSERT INTO project_subscriptions (project_id, user_id) VALUES ($1, $2)',
        [projectId, userId]
      );
      res.json({ isSubscribed: true, message: 'Subscribed to project' });
    }
  } catch (error) {
    console.error('Error toggling subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getComments,
  addComment,
  getActivityFeed,
  checkSubscription,
  toggleSubscription
};
