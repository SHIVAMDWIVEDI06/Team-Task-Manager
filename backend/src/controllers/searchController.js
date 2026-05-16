const { pool } = require('../config/db');

/**
 * Highlight matching text in a string
 * @param {string} text - The text to highlight
 * @param {string} query - The search query
 * @returns {string} Text with highlighted matches
 */
const highlightText = (text, query) => {
  if (!text || !query) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};

/**
 * Search across projects, tasks, and team members
 * @param {string} query - Search query string
 * @param {number} userId - Current user ID for permission filtering
 * @param {number} limit - Maximum number of results per entity type
 * @param {number} offset - Pagination offset
 * @returns {Promise<Object>} Search results with highlighted text
 */
const searchAll = async (query, userId, limit = 10, offset = 0) => {
  if (!query || query.trim() === '') {
    return {
      projects: [],
      tasks: [],
      teamMembers: [],
      total: 0
    };
  }

  const searchTerm = `%${query}%`;
  const client = await pool.connect();

  try {
    // Search projects that the user is a member of
    const projectsQuery = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.admin_id,
        p.created_at,
        CASE 
          WHEN p.name ILIKE $1 THEN 'name'
          WHEN p.description ILIKE $1 THEN 'description'
          ELSE 'other'
        END as matched_field
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = $3
        AND (p.name ILIKE $1 OR p.description ILIKE $1)
      ORDER BY 
        CASE 
          WHEN p.name ILIKE $1 THEN 1
          WHEN p.description ILIKE $1 THEN 2
          ELSE 3
        END,
        p.created_at DESC
      LIMIT $4 OFFSET $5
    `;

    // Search tasks in projects that the user is a member of
    const tasksQuery = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.assigned_user_id,
        t.project_id,
        p.name as project_name,
        u.username as assigned_username,
        CASE 
          WHEN t.title ILIKE $1 THEN 'title'
          WHEN t.description ILIKE $1 THEN 'description'
          ELSE 'other'
        END as matched_field
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN users u ON t.assigned_user_id = u.id
      WHERE pm.user_id = $3
        AND (t.title ILIKE $1 OR t.description ILIKE $1)
      ORDER BY 
        CASE 
          WHEN t.title ILIKE $1 THEN 1
          WHEN t.description ILIKE $1 THEN 2
          ELSE 3
        END,
        t.created_at DESC
      LIMIT $4 OFFSET $5
    `;

    // Search team members in projects that the user is a member of
    const teamMembersQuery = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.role,
        u.created_at as join_date,
        p.id as project_id,
        p.name as project_name,
        CASE 
          WHEN u.username ILIKE $1 THEN 'username'
          WHEN u.email ILIKE $1 THEN 'email'
          ELSE 'other'
        END as matched_field
      FROM users u
      JOIN project_members pm ON u.id = pm.user_id
      JOIN projects p ON pm.project_id = p.id
      JOIN project_members pm2 ON p.id = pm2.project_id
      WHERE pm2.user_id = $3
        AND (u.username ILIKE $1 OR u.email ILIKE $1)
      GROUP BY u.id, p.id, p.name
      ORDER BY 
        CASE 
          WHEN u.username ILIKE $1 THEN 1
          WHEN u.email ILIKE $1 THEN 2
          ELSE 3
        END,
        u.username
      LIMIT $4 OFFSET $5
    `;

    // Get total counts for pagination
    const countsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM projects p JOIN project_members pm ON p.id = pm.project_id WHERE pm.user_id = $3 AND (p.name ILIKE $1 OR p.description ILIKE $1)) as projects_count,
        (SELECT COUNT(*) FROM tasks t JOIN projects p ON t.project_id = p.id JOIN project_members pm ON p.id = pm.project_id WHERE pm.user_id = $3 AND (t.title ILIKE $1 OR t.description ILIKE $1)) as tasks_count,
        (SELECT COUNT(DISTINCT u.id) FROM users u JOIN project_members pm ON u.id = pm.user_id JOIN projects p ON pm.project_id = p.id JOIN project_members pm2 ON p.id = pm2.project_id WHERE pm2.user_id = $3 AND (u.username ILIKE $1 OR u.email ILIKE $1)) as team_members_count
    `;

    // Execute all queries in parallel
    const [projectsResult, tasksResult, teamMembersResult, countsResult] = await Promise.all([
      client.query(projectsQuery, [searchTerm, query, userId, limit, offset]),
      client.query(tasksQuery, [searchTerm, query, userId, limit, offset]),
      client.query(teamMembersQuery, [searchTerm, query, userId, limit, offset]),
      client.query(countsQuery, [searchTerm, query, userId])
    ]);

    // Add highlighting to results
    const projects = projectsResult.rows.map(project => ({
      ...project,
      highlighted_name: highlightText(project.name, query),
      highlighted_description: highlightText(project.description, query)
    }));

    const tasks = tasksResult.rows.map(task => ({
      ...task,
      highlighted_title: highlightText(task.title, query),
      highlighted_description: highlightText(task.description, query)
    }));

    const teamMembers = teamMembersResult.rows.map(member => ({
      ...member,
      highlighted_username: highlightText(member.username, query),
      highlighted_email: highlightText(member.email, query)
    }));

    const totalCount = 
      parseInt(countsResult.rows[0].projects_count) + 
      parseInt(countsResult.rows[0].tasks_count) + 
      parseInt(countsResult.rows[0].team_members_count);

    return {
      projects,
      tasks,
      teamMembers,
      total: totalCount,
      counts: {
        projects: parseInt(countsResult.rows[0].projects_count),
        tasks: parseInt(countsResult.rows[0].tasks_count),
        teamMembers: parseInt(countsResult.rows[0].team_members_count)
      }
    };
  } catch (error) {
    console.error('Error in searchAll:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Search controller function for API endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const search = async (req, res) => {
  const { q: query, limit = 10, page = 1 } = req.query;
  const userId = req.user.id;

  if (!query || query.trim() === '') {
    return res.status(400).json({ 
      error: 'Search query is required',
      suggestions: ['Try searching for project names, task titles, or team member names']
    });
  }

  try {
    const offset = (page - 1) * limit;
    const results = await searchAll(query, userId, parseInt(limit), offset);

    res.status(200).json({
      query,
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.total,
        totalPages: Math.ceil(results.total / limit)
      }
    });
  } catch (error) {
    console.error('Error in search controller:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to perform search'
    });
  }
};

/**
 * Get search suggestions for autocomplete
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSuggestions = async (req, res) => {
  const { q: query, limit = 5 } = req.query;
  const userId = req.user.id;

  if (!query || query.trim() === '') {
    return res.status(200).json({ suggestions: [] });
  }

  const searchTerm = `%${query}%`;
  
  try {
    const suggestionsQuery = `
      (
        SELECT 
          'project' as type,
          p.id,
          p.name as title,
          p.description as subtitle,
          'projects' as route
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = $1 AND p.name ILIKE $2
        LIMIT $3
      )
      UNION ALL
      (
        SELECT 
          'task' as type,
          t.id,
          t.title,
          p.name as subtitle,
          'tasks' as route
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = $1 AND t.title ILIKE $2
        LIMIT $3
      )
      UNION ALL
      (
        SELECT 
          'user' as type,
          u.id,
          u.username as title,
          u.email as subtitle,
          'team' as route
        FROM users u
        JOIN project_members pm ON u.id = pm.user_id
        JOIN projects p ON pm.project_id = p.id
        JOIN project_members pm2 ON p.id = pm2.project_id
        WHERE pm2.user_id = $1 AND u.username ILIKE $2
        LIMIT $3
      )
      ORDER BY type
    `;

    const result = await pool.query(suggestionsQuery, [userId, searchTerm, parseInt(limit) * 3]);
    
    res.status(200).json({
      query,
      suggestions: result.rows
    });
  } catch (error) {
    console.error('Error in getSuggestions:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to get search suggestions'
    });
  }
};

module.exports = {
  search,
  getSuggestions,
  searchAll // Export for testing
};