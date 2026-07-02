const express = require('express');
const router = express.Router();
const { getAllStaff, createStaff, updateStaff, deleteStaff } = require('../controllers/staffController');
const { protect, authorize, tenantIsolation, checkPermission } = require('../middleware/auth');

router.use(protect, authorize('superadmin', 'owner', 'staff'), tenantIsolation);

router.get('/', getAllStaff);
router.post('/', authorize('superadmin', 'owner'), createStaff);
router.put('/:id', authorize('superadmin', 'owner'), updateStaff);
router.delete('/:id', authorize('superadmin', 'owner'), deleteStaff);

module.exports = router;
