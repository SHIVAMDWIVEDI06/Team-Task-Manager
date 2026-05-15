const { pool } = require('../config/db');

// Create a new task (Admin only)
const createTask = async (req, res) => {
  const { title, description, due_date, priority, assigned_user_id, project_id } = req.body;
  const adminId = req.user.id;

  if (!title || !project_id) {
    return res.status(400).json({ error: 'Title and project_id are required' });
  }

  try {
    // Verify that the user is the project admin
    const projectResult = await pool.query('SELECT admin_id FROM projects WHERE id = $1', [project_id]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (projectResult.rows[0].admin_id !== adminId) {
      return res.status(403).json({ error: 'Only the project admin can create tasks' });
    }

    // Verify assigned user is a member of the project (if assigning someone)
    if (assigned_user_id && assigned_user_id !== '') {
      const memberCheck = await pool.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [project_id, assigned_user_id]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Assigned user is not a member of this project' });
      }
    }

    // Insert task
    const taskResult = await pool.query(
      `INSERT INTO tasks (title, description, due_date, priority, status, assigned_user_id, project_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, due_date || null, priority || 'Medium', req.body.status || 'To Do', assigned_user_id || null, project_id]
    );

    res.status(201).json({
      message: 'Task created successfully',
      task: taskResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get tasks assigned to the current user
const getMyTasks = async (req, res) => {
  const userId = req.user.id;

  try {
    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE assigned_user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.status(200).json(tasksResult.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a task (Assignee or Admin)
const updateTask = async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body; // Usually members just update status
  const userId = req.user.id;

  try {
    // Find the task and its project's admin
    const taskResult = await pool.query(
      `SELECT t.*, p.admin_id 
       FROM tasks t 
       JOIN projects p ON t.project_id = p.id 
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check permissions: must be assigned user OR project admin
    if (task.assigned_user_id !== userId && task.admin_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this task' });
    }

    // Update status
    const updatedTask = await pool.query(
      'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
      [status || task.status, taskId]
    );

    res.status(200).json({
      message: 'Task updated successfully',
      task: updatedTask.rows[0]
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all tasks for a project
const getProjectTasks = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  try {
    // Get user's role and project admin status
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    const projectResult = await pool.query('SELECT admin_id FROM projects WHERE id = $1', [projectId]);
    
    const userRole = userResult.rows[0].role;
    const projectAdminId = projectResult.rows[0].admin_id;

    let query = `
      SELECT t.*, u.username as assigned_username 
      FROM tasks t 
      LEFT JOIN users u ON t.assigned_user_id = u.id 
      WHERE t.project_id = $1
    `;
    let queryParams = [projectId];

    // If not global Admin AND not project creator, only show assigned tasks
    if (userRole !== 'Admin' && projectAdminId !== userId) {
      query += ` AND t.assigned_user_id = $2`;
      queryParams.push(userId);
    }

    query += ` ORDER BY t.created_at ASC`;

    const tasksResult = await pool.query(query, queryParams);

    res.status(200).json(tasksResult.rows);
  } catch (error) {
    console.error('Error fetching project tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteTask = async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  try {
    const taskResult = await pool.query(
      'SELECT t.*, p.admin_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (taskResult.rows[0].admin_id !== userId) {
      return res.status(403).json({ error: 'Only the project admin can delete tasks' });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createTask,
  getMyTasks,
  updateTask,
  getProjectTasks,
  deleteTask
};
