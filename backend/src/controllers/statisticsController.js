const { pool } = require('../config/db');

// Get user statistics
const getUserStatistics = async (req, res) => {
  const { userId } = req.params;

  try {
    // Get total tasks assigned to user
    const totalTasksResult = await pool.query(
      'SELECT COUNT(*) as total FROM tasks WHERE assigned_user_id = $1',
      [userId]
    );

    // Get completed tasks
    const completedTasksResult = await pool.query(
      "SELECT COUNT(*) as completed FROM tasks WHERE assigned_user_id = $1 AND status = 'Done'",
      [userId]
    );

    // Get in-progress tasks
    const inProgressTasksResult = await pool.query(
      "SELECT COUNT(*) as in_progress FROM tasks WHERE assigned_user_id = $1 AND status = 'In Progress'",
      [userId]
    );

    // Get overdue tasks
    const overdueTasksResult = await pool.query(
      "SELECT COUNT(*) as overdue FROM tasks WHERE assigned_user_id = $1 AND status != 'Done' AND due_date < CURRENT_DATE",
      [userId]
    );

    // Get tasks by priority
    const priorityBreakdownResult = await pool.query(
      'SELECT priority, COUNT(*) as count FROM tasks WHERE assigned_user_id = $1 GROUP BY priority',
      [userId]
    );

    // Get recent activity (last 10 tasks)
    const recentActivityResult = await pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.created_at, p.name as project_name
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE t.assigned_user_id = $1
       ORDER BY t.created_at DESC
       LIMIT 10`,
      [userId]
    );

    // Get user info
    const userInfoResult = await pool.query(
      'SELECT username, email, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    const totalTasks = parseInt(totalTasksResult.rows[0].total);
    const completedTasks = parseInt(completedTasksResult.rows[0].completed);
    const inProgressTasks = parseInt(inProgressTasksResult.rows[0].in_progress);
    const overdueTasks = parseInt(overdueTasksResult.rows[0].overdue);

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

    // Priority breakdown
    const priorityBreakdown = {
      High: 0,
      Medium: 0,
      Low: 0
    };
    priorityBreakdownResult.rows.forEach(row => {
      priorityBreakdown[row.priority] = parseInt(row.count);
    });

    res.status(200).json({
      user: userInfoResult.rows[0],
      statistics: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        completionRate: parseFloat(completionRate),
        priorityBreakdown
      },
      recentActivity: recentActivityResult.rows
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get team-wide statistics
const getTeamStatistics = async (req, res) => {
  try {
    // Get all users with their task counts
    const usersStatsResult = await pool.query(
      `SELECT 
        u.id, 
        u.username, 
        u.email,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'Done' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status = 'In Progress' THEN 1 END) as in_progress_tasks
       FROM users u
       LEFT JOIN tasks t ON u.id = t.assigned_user_id
       GROUP BY u.id, u.username, u.email
       ORDER BY total_tasks DESC`
    );

    // Get overall team statistics
    const teamTotalsResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT u.id) as total_members,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'Done' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status = 'In Progress' THEN 1 END) as in_progress_tasks,
        COUNT(DISTINCT p.id) as total_projects
       FROM users u
       LEFT JOIN tasks t ON u.id = t.assigned_user_id
       LEFT JOIN projects p ON t.project_id = p.id`
    );

    const teamTotals = teamTotalsResult.rows[0];
    const avgCompletionRate = teamTotals.total_tasks > 0 
      ? ((teamTotals.completed_tasks / teamTotals.total_tasks) * 100).toFixed(1)
      : 0;

    res.status(200).json({
      teamOverview: {
        totalMembers: parseInt(teamTotals.total_members),
        totalProjects: parseInt(teamTotals.total_projects),
        totalTasks: parseInt(teamTotals.total_tasks),
        completedTasks: parseInt(teamTotals.completed_tasks),
        inProgressTasks: parseInt(teamTotals.in_progress_tasks),
        avgCompletionRate: parseFloat(avgCompletionRate)
      },
      memberStats: usersStatsResult.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        totalTasks: parseInt(row.total_tasks),
        completedTasks: parseInt(row.completed_tasks),
        inProgressTasks: parseInt(row.in_progress_tasks),
        completionRate: row.total_tasks > 0 
          ? ((row.completed_tasks / row.total_tasks) * 100).toFixed(1)
          : 0
      }))
    });
  } catch (error) {
    console.error('Error fetching team statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getUserStatistics,
  getTeamStatistics
};
