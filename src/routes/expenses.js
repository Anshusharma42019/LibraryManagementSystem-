const express = require('express');
const router = express.Router();
const { getAllExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary } = require('../controllers/expenseController');
const { protect, authorize, tenantIsolation, checkPermission } = require('../middleware/auth');

router.use(protect, authorize('superadmin', 'owner', 'staff'), tenantIsolation);

router.get('/summary', getExpenseSummary);
router.get('/', getAllExpenses);
router.post('/', checkPermission('canManageExpenses'), createExpense);
router.put('/:id', checkPermission('canManageExpenses'), updateExpense);
router.delete('/:id', checkPermission('canManageExpenses'), deleteExpense);

module.exports = router;
