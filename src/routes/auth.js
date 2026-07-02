const express = require('express');
const router = express.Router();
const { login, refreshToken, logout, getMe, changePassword, registerSuperAdmin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/register/superadmin', registerSuperAdmin);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;
