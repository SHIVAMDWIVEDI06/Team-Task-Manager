const { pool } = require('../config/db');

// GET /api/dashboard/:projectId
const getDashboard = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  try {
    // Verify project exists and user is a member or admin
    const projectCheck = await pool.query(
      `SELECT p.admin_id FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
       WHERE p.id = $1 AND (p.admin_id = $2 OR pm.user_id IS NOT NULL)`,
      [projectId, userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized or project not found' });
    }

    const isAdmin = projectCheck.rows[0].admin_id === userId;

    // Single optimized query using CTEs for all three analytics
    const analyticsQuery = `
      WITH project_tasks AS (
        SELECT * FROM tasks WHERE project_id = $1
      ),
      trends AS (
        SELECT 
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_tasks_this_week,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days') as new_tasks_last_week,
          COUNT(*) FILTER (WHERE status = 'Done' AND created_at >= CURRENT_DATE - INTERVAL '7 days') as done_this_week,
          COUNT(*) FILTER (WHERE status = 'Done' AND created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days') as done_last_week
        FROM project_tasks
      ),
      workload AS (
        SELECT 
          u.id AS user_id,
          u.username,
          COUNT(pt.id) AS in_progress_count
        FROM project_tasks pt
        JOIN users u ON u.id = pt.assigned_user_id
        WHERE pt.status = 'In Progress'
        GROUP BY u.id, u.username
        ORDER BY in_progress_count DESC
      ),
      overdue_high AS (
        SELECT 
          pt.id AS task_id,
          pt.title,
          pt.due_date,
          pt.status,
          u.username AS assigned_to
        FROM project_tasks pt
        LEFT JOIN users u ON u.id = pt.assigned_user_id
        WHERE pt.due_date < CURRENT_DATE
          AND pt.priority = 'High'
          AND pt.status != 'Done'
        ORDER BY pt.due_date ASC
      ),
      completion AS (
        SELECT 
          COUNT(*) AS total_tasks,
          COUNT(*) FILTER (WHERE status = 'Done') AS done_tasks,
          COUNT(*) FILTER (WHERE status = 'To Do') AS todo_tasks,
          COUNT(*) FILTER (WHERE status = 'In Progress') AS inprogress_tasks
        FROM project_tasks
      )
      SELECT 
        json_build_object(
          'trends', (SELECT row_to_json(t) FROM trends t),
          'workload', (SELECT COALESCE(json_agg(w), '[]'::json) FROM workload w),
          'overdueHighPriority', (SELECT COALESCE(json_agg(o), '[]'::json) FROM overdue_high o),
          'completion', (SELECT row_to_json(c) FROM completion c)
        ) AS dashboard;
    `;

    const startTime = Date.now();
    const result = await pool.query(analyticsQuery, [projectId]);
    const queryTime = Date.now() - startTime;

    const dashboard = result.rows[0].dashboard;

    // Calculate completion rate percentage
    const { total_tasks, done_tasks, todo_tasks, inprogress_tasks } = dashboard.completion;
    const completionRate = total_tasks > 0 
      ? parseFloat(((done_tasks / total_tasks) * 100).toFixed(1)) 
      : 0;

    const trendsData = dashboard.trends || {};
    const taskTrend = trendsData.new_tasks_last_week > 0 
      ? Math.round(((trendsData.new_tasks_this_week - trendsData.new_tasks_last_week) / trendsData.new_tasks_last_week) * 100)
      : (trendsData.new_tasks_this_week > 0 ? 100 : 0);
      
    const doneTrend = trendsData.done_last_week > 0
      ? Math.round(((trendsData.done_this_week - trendsData.done_last_week) / trendsData.done_last_week) * 100)
      : (trendsData.done_this_week > 0 ? 100 : 0);

    res.status(200).json({
      projectId: parseInt(projectId),
      isAdmin,
      trends: {
        taskTrend,
        doneTrend
      },
      workloadAnalysis: dashboard.workload,
      overdueHighPriority: dashboard.overdueHighPriority,
      completionRate: {
        totalTasks: parseInt(total_tasks),
        doneTasks: parseInt(done_tasks),
        todoTasks: parseInt(todo_tasks),
        inprogressTasks: parseInt(inprogress_tasks),
        percentage: completionRate
      },
      queryTimeMs: queryTime
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getDashboard };
