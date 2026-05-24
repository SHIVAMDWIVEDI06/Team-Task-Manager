const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const settingsController = require('../controllers/settingsController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/settings - Get current user's settings
router.get('/', settingsController.getUserSettings);

// PATCH /api/settings - Update current user's settings
router.patch('/', settingsController.updateUserSettings);

module.exports = router;
