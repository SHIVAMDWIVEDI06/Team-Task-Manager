const express = require('express');
const router = express.Router();
const collaborationController = require('../controllers/collaborationController');
const authMiddleware = require('../middleware/authMiddleware');

// Require authentication for all collaboration routes
router.use(authMiddleware);

// Comments
router.get('/tasks/:taskId/comments', collaborationController.getComments);
router.post('/tasks/:taskId/comments', collaborationController.addComment);

// Activity Feed
router.get('/projects/:projectId/activity', collaborationController.getActivityFeed);

// Subscriptions
router.get('/projects/:projectId/subscription', collaborationController.checkSubscription);
router.post('/projects/:projectId/subscription', collaborationController.toggleSubscription);

module.exports = router;
