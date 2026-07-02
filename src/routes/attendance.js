const express = require('express');
const router = express.Router();
const {
  getAttendance,
  markAttendance,
  checkIn,
  checkOut,
  bookSlot,
  getAttendanceReport,
  getTodaySummary,
  getActiveCheckIns,
} = require('../controllers/attendanceController');
const { protect, authorize, tenantIsolation } = require('../middleware/auth');

router.use(protect, authorize('superadmin', 'owner', 'staff'), tenantIsolation);

router.get('/today-summary', getTodaySummary);
router.get('/report', getAttendanceReport);
router.get('/active-checkins', getActiveCheckIns);
router.get('/', getAttendance);

router.post('/', markAttendance);
router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.post('/book-slot', bookSlot);

module.exports = router;
