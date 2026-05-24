const { pool } = require('../config/db');
const crypto = require('crypto');

// Generate unique token for invitation
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send an invitation
const sendInvitation = async (req, res) => {
  const { email } = req.body;
  const adminId = req.user.id;

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    // Check if user already exists
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check for existing pending invitation
    const invCheck = await pool.query('SELECT id FROM invitations WHERE email = $1 AND status = $2', [email, 'Pending']);
    if (invCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A pending invitation already exists for this email' });
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const newInvitation = await pool.query(
      'INSERT INTO invitations (email, invited_by, token, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, adminId, token, expiresAt]
    );

    // Mock sending email
    console.log(`[Email Service Mock] Invitation sent to ${email}. Registration link: /signup?token=${token}`);

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: newInvitation.rows[0]
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all invitations
const getInvitations = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.email, i.status, i.expires_at, i.created_at, u.username as invited_by_name
       FROM invitations i
       LEFT JOIN users u ON i.invited_by = u.id
       ORDER BY i.created_at DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Expire old invitations
const expireOldInvitations = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE invitations 
       SET status = 'Expired' 
       WHERE status = 'Pending' AND expires_at < CURRENT_TIMESTAMP
       RETURNING id`
    );
    res.status(200).json({ message: `Expired ${result.rowCount} old invitations` });
  } catch (error) {
    console.error('Error expiring invitations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  sendInvitation,
  getInvitations,
  expireOldInvitations
};
