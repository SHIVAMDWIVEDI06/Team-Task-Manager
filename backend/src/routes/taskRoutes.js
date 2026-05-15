const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all task routes
router.use(authMiddleware);

router.post('/', taskController.createTask);
router.get('/my-tasks', taskController.getMyTasks);
router.get('/project/:projectId', taskController.getProjectTasks);
router.put('/:taskId', taskController.updateTask);
router.delete('/:taskId', taskController.deleteTask);

module.exports = router;
