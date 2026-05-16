const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all statistics routes
router.use(authMiddleware);

router.get('/user/:userId', statisticsController.getUserStatistics);
router.get('/team', statisticsController.getTeamStatistics);

module.exports = router;
