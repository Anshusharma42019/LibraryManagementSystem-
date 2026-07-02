const express = require('express');
const router = express.Router();
const { getAllPayments, collectPayment, getPaymentSummary } = require('../controllers/paymentController');
const { protect, authorize, tenantIsolation, checkPermission } = require('../middleware/auth');

router.use(protect, authorize('superadmin', 'owner', 'staff'), tenantIsolation);

router.get('/summary', getPaymentSummary);
router.get('/', getAllPayments);
router.post('/', checkPermission('canCollectFees'), collectPayment);

module.exports = router;
