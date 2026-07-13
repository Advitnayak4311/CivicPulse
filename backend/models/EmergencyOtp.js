const mongoose = require('mongoose');

/**
 * EmergencyOtp Schema
 * Stores OTP codes for emergency complaint verification.
 * Each document auto-expires after 10 minutes using MongoDB TTL index.
 */
const emergencyOtpSchema = new mongoose.Schema({
  // Contact info
  name:    { type: String, required: false, trim: true },
  email:   { type: String, required: false, lowercase: true, trim: true },
  phone:   { type: String, required: false, trim: true },

  // 6-digit OTP code
  otpCode: { type: String, required: true },

  // Tracks if OTP was already used to prevent replay attacks
  verified: { type: Boolean, default: false },

  // Attempts counter to prevent brute-force
  attempts: { type: Number, default: 0 },

  // Auto-expire after 10 minutes
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.model('EmergencyOtp', emergencyOtpSchema);
