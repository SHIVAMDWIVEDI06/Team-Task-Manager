const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/notifications - Get all notifications for the current user
router.get('/', notificationController.getNotifications);

// PATCH /api/notifications/:id/read - Mark a notification as read
router.patch('/:id/read', notificationController.markAsRead);

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch('/read-all', notificationController.markAllAsRead);

// POST /api/notifications/archive - Archive old notifications (older than 30 days)
router.post('/archive', notificationController.archiveOldNotifications);

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;