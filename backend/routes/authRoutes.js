const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  sendProfileOtp,
  registerSendOtp,
  registerVerify,
  forgotPasswordSendOtp,
  forgotPasswordReset
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/register', registerUser);
router.post('/register/send-otp', registerSendOtp);
router.post('/register/verify', registerVerify);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, upload.single('profilePhoto'), updateUserProfile);
router.post('/send-otp', protect, sendProfileOtp);
router.post('/forgot-password/send-otp', forgotPasswordSendOtp);
router.post('/forgot-password/reset', forgotPasswordReset);

module.exports = router;
