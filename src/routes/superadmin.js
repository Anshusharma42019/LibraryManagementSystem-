const express = require('express');
const router = express.Router();
const {
  getAllLibraries,
  createLibrary,
  updateLibrary,
  updateLibraryStatus,
  deleteLibrary,
  getSuperAdminDashboard,
} = require('../controllers/libraryController');
const { protect, authorize } = require('../middleware/auth');

// All superadmin routes - protected + superadmin only
router.use(protect, authorize('superadmin'));

router.get('/dashboard', getSuperAdminDashboard);
router.get('/libraries', getAllLibraries);
router.post('/libraries', createLibrary);
router.put('/libraries/:id', updateLibrary);
router.patch('/libraries/:id/status', updateLibraryStatus);
router.delete('/libraries/:id', deleteLibrary);

module.exports = router;
