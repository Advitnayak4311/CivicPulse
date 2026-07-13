const express = require('express');
const router = express.Router();
const {
  getUsers,
  toggleUserStatus,
  createAuthority,
  deleteComplaint,
  getAnalytics,
  verifyAndAssignComplaint,
  escalateComplaint
} = require('../controllers/adminController');
const { getDepartments } = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes here require Admin role
router.use(protect, authorize('admin'));

router.get('/users', getUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.post('/authorities', createAuthority);
router.delete('/complaints/:id', deleteComplaint);
router.get('/analytics', getAnalytics);

// Verify + Assign Department (Admin workflow)
router.put('/complaints/:id/verify', verifyAndAssignComplaint);

// Escalate Complaint (Admin workflow)
router.put('/complaints/:id/escalate', escalateComplaint);

// Departments list for reassignment modal
router.get('/departments', getDepartments);

module.exports = router;

