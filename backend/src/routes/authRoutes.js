const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/users', authMiddleware, authController.getUsers);

module.exports = router;
