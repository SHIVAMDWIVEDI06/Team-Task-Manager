const { pool } = require('../config/db');

// Create a new project
const createProject = async (req, res) => {
  const { name, description } = req.body;
  const adminId = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert new project
    const projectResult = await client.query(
      'INSERT INTO projects (name, description, admin_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, adminId]
    );

    const newProject = projectResult.rows[0];

    // Add admin as a project member automatically
    await client.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)',
      [newProject.id, adminId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Project created successfully',
      project: newProject
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Add a member to a project
const addMember = async (req, res) => {
  const { projectId } = req.params;
  const { userId } = req.body; // the user to be added
  const adminId = req.user.id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Verify that the requester is the admin of the project
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (projectResult.rows[0].admin_id !== adminId) {
      return res.status(403).json({ error: 'Only the project admin can add members' });
    }

    // Add user to project_members
    await pool.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [projectId, userId]
    );

    res.status(200).json({ message: 'User added to project successfully' });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all projects for the current user
const getProjects = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT p.* FROM projects p 
       JOIN project_members pm ON p.id = pm.project_id 
       WHERE pm.user_id = $1`,
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a project
const deleteProject = async (req, res) => {
  const { projectId } = req.params;
  const adminId = req.user.id;

  try {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 AND admin_id = $2 RETURNING *', [projectId, adminId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove a member from a project
const removeMember = async (req, res) => {
  const { projectId, userId } = req.params;
  const adminId = req.user.id;

  try {
    // Verify requester is project admin
    const projectResult = await pool.query('SELECT admin_id FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows[0].admin_id !== adminId) {
      return res.status(403).json({ error: 'Only project admin can remove members' });
    }

    await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
    res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProjectMembers = async (req, res) => {
  const { projectId } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email 
       FROM users u 
       JOIN project_members pm ON u.id = pm.user_id 
       WHERE pm.project_id = $1`,
      [projectId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createProject,
  addMember,
  removeMember,
  getProjects,
  deleteProject,
  getProjectMembers
};
