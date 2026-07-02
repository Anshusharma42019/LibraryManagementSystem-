const express = require('express');
const router = express.Router();
const {
  getAllStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getExpiringStudents,
  getPendingFees,
} = require('../controllers/studentController');
const { protect, authorize, tenantIsolation, checkPermission } = require('../middleware/auth');

router.use(protect, authorize('superadmin', 'owner', 'staff'), tenantIsolation);

router.get('/expiring', getExpiringStudents);
router.get('/pending-fees', getPendingFees);
router.get('/', getAllStudents);
router.get('/:id', getStudent);
router.post('/', checkPermission('canManageStudents'), createStudent);
router.put('/:id', checkPermission('canManageStudents'), updateStudent);
router.delete('/:id', authorize('superadmin', 'owner'), deleteStudent);

module.exports = router;
