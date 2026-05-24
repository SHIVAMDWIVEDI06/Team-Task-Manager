const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin } = authMiddleware;
const { sendInvitation, getInvitations, expireOldInvitations } = require('../controllers/invitationController');

// All invitation routes require authentication and admin privileges
router.use(authMiddleware);
router.use(isAdmin);

router.post('/', sendInvitation);
router.get('/', getInvitations);
router.post('/expire', expireOldInvitations);

module.exports = router;
