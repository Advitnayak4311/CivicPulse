const express = require('express');
const router = express.Router();
const { sendEmergencyOtp, verifyOtpAndSubmitEmergency } = require('../controllers/emergencyController');
const upload = require('../middleware/uploadMiddleware');

// Send OTP to citizen email (public)
router.post('/send-otp', sendEmergencyOtp);

// Verify OTP and submit the emergency complaint (public, optional image)
router.post('/submit', upload.single('image'), verifyOtpAndSubmitEmergency);

module.exports = router;
