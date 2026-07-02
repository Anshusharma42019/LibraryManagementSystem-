const express = require('express');
const router = express.Router();
const {
  studentLogin,
  protectStudent,
  studentCheckIn,
  studentCheckOut,
  getStudentMe,
  getMyAttendance,
  getMyPayments,
  setPin,
} = require('../controllers/studentPortalController');
const { protect, authorize, tenantIsolation } = require('../middleware/auth');

// Public
router.post('/login', studentLogin);

// Student protected routes
router.get('/me',         protectStudent, getStudentMe);
router.post('/checkin',   protectStudent, studentCheckIn);
router.post('/checkout',  protectStudent, studentCheckOut);
router.get('/attendance', protectStudent, getMyAttendance);
router.get('/payments',   protectStudent, getMyPayments);

// Owner/Staff sets PIN for a student
router.post('/set-pin', protect, authorize('superadmin', 'owner', 'staff'), tenantIsolation, setPin);

module.exports = router;
