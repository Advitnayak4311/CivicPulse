const express = require('express');
const router = express.Router();
const {
  checkDuplicate,
  createComplaint,
  getComplaints,
  getMyComplaints,
  trackComplaintPublic,
  getComplaintById,
  supportComplaint,
  updateComplaintStatus,
  submitFeedback
} = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Check duplicate before submission
router.post('/check-duplicate', protect, checkDuplicate);

// Submit complaint (Citizen only, with single image upload)
router.post('/', protect, authorize('citizen'), upload.single('image'), createComplaint);

// Get complaints (Filtered and paginated)
router.get('/', protect, getComplaints);

// Get current citizen's own complaints
router.get('/my-complaints', protect, authorize('citizen'), getMyComplaints);

// PUBLIC: Track complaint by reference ID (e.g. CIV-XXXXXX) - No login required
router.get('/track/:complaintId', trackComplaintPublic);

// Get specific complaint details (authenticated)
router.get('/:id', protect, getComplaintById);

// Support a complaint
router.post('/:id/support', protect, authorize('citizen'), supportComplaint);

// Submit feedback and rating
router.post('/:id/feedback', protect, authorize('citizen'), submitFeedback);

// Update status (Authority and Admin, with optional before/after repair image uploads)
router.put(
  '/:id/status',
  protect,
  authorize('authority', 'admin'),
  upload.fields([
    { name: 'beforeImage', maxCount: 1 },
    { name: 'afterImage', maxCount: 1 }
  ]),
  updateComplaintStatus
);

module.exports = router;
