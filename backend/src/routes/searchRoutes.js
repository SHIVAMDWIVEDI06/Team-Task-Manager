const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const searchController = require('../controllers/searchController');

/**
 * @route GET /api/search
 * @desc Search across projects, tasks, and team members
 * @access Private
 * @query {string} q - Search query
 * @query {number} [limit=10] - Results per page
 * @query {number} [page=1] - Page number
 */
router.get('/', authMiddleware, searchController.search);

/**
 * @route GET /api/search/suggestions
 * @desc Get search suggestions for autocomplete
 * @access Private
 * @query {string} q - Search query
 * @query {number} [limit=5] - Maximum suggestions per type
 */
router.get('/suggestions', authMiddleware, searchController.getSuggestions);

module.exports = router;