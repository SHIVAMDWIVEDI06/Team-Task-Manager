const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/profile - Get current user's profile
router.get('/', profileController.getUserProfile);

// PATCH /api/profile - Update current user's profile
router.patch('/', profileController.updateUserProfile);

// POST /api/profile/avatar - Upload user avatar
router.post('/avatar', profileController.uploadAvatar);

module.exports = router;
