const express = require('express');
const router = express.Router();
const {
  getAllSeats, createSeat, bulkCreateSeats,
  updateSeat, deleteSeat, assignSeat, unassignSeat,
} = require('../controllers/seatController');
const { protect, authorize, tenantIsolation, checkPermission } = require('../middleware/auth');

router.use(protect, authorize('superadmin', 'owner', 'staff'), tenantIsolation);

router.get('/', getAllSeats);
router.post('/', checkPermission('canManageSeats'), createSeat);
router.post('/bulk', checkPermission('canManageSeats'), bulkCreateSeats);
router.put('/:id', checkPermission('canManageSeats'), updateSeat);
router.delete('/:id', checkPermission('canManageSeats'), deleteSeat);
router.patch('/:id/assign', checkPermission('canManageSeats'), assignSeat);
router.patch('/:id/unassign', checkPermission('canManageSeats'), unassignSeat);

module.exports = router;
