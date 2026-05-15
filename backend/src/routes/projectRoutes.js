const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all project routes
router.use(authMiddleware);

router.post('/', projectController.createProject);
router.get('/', projectController.getProjects);
router.delete('/:projectId', projectController.deleteProject);
router.post('/:projectId/members', projectController.addMember);
router.get('/:projectId/members', projectController.getProjectMembers);
router.delete('/:projectId/members/:userId', projectController.removeMember);

module.exports = router;
