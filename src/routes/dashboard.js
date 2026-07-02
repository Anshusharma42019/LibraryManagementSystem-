const express = require('express');
const router = express.Router();
const { getDashboard, updateLibrarySettings } = require('../controllers/dashboardController');
const { protect, authorize, tenantIsolation } = require('../middleware/auth');

router.use(protect);

router.get('/', authorize('superadmin', 'owner', 'staff'), tenantIsolation, getDashboard);
router.put('/settings', authorize('owner'), updateLibrarySettings);

module.exports = router;
