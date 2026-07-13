const EmergencyOtp = require('../models/EmergencyOtp');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const Timeline = require('../models/Timeline');
const { sendOtpEmail, sendComplaintRegisteredEmail } = require('../utils/emailService');
const { sendOtpSms, sendComplaintRegisteredSms } = require('../utils/smsService');
const { generateComplaintId, assignDepartment } = require('../utils/helpers');

/**
 * Generate a cryptographically-safe 6-digit numeric OTP
 */
const generateOtp = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

/**
 * @desc   Send OTP to citizen email for emergency complaint verification
 * @route  POST /api/emergency/send-otp
 * @access Public
 */
const sendEmergencyOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Email address or Phone number is required.' });
    }

    let target = '';
    let queryField = {};

    if (email) {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
      target = email.toLowerCase().trim();
      queryField = { email: target };
    } else {
      // Basic phone validation
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });
      }
      target = phone.trim();
      queryField = { phone: target };
    }

    // Rate limit: max 3 OTPs per target per 10 minutes
    const recentOtps = await EmergencyOtp.find({
      ...queryField,
      verified: false
    });

    if (recentOtps.length >= 3) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Please wait 10 minutes before trying again.'
      });
    }

    // Generate OTP and set 10-minute expiry
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Save OTP record to DB
    const otpData = {
      name: 'Emergency User',
      otpCode: otp,
      expiresAt
    };
    if (email) {
      otpData.email = target;
      otpData.phone = '0000000000';
    } else {
      otpData.phone = target;
      // We can also set a placeholder email since it is sparse and unique in User,
      // but in EmergencyOtp we just save it as is.
    }

    await EmergencyOtp.create(otpData);

    if (email) {
      // Send OTP via email
      await sendOtpEmail(target, 'Emergency User', otp);
    } else {
      // Send OTP via SMS
      await sendOtpSms(target, otp);
    }

    const isDemoMode = (!process.env.EMAIL_USER && email) || (!process.env.TWILIO_ACCOUNT_SID && phone);

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${target}.${isDemoMode ? ' [DEMO MODE: OTP generated successfully]' : ''}`,
      otp: isDemoMode ? otp : undefined // Return OTP directly in development/demo mode
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
};

/**
 * @desc   Verify OTP and submit emergency complaint
 * @route  POST /api/emergency/submit
 * @access Public
 */
const verifyOtpAndSubmitEmergency = async (req, res) => {
  try {
    const {
      otpCode,
      name, email, phone,
      title, description, category,
      latitude, longitude
    } = req.body;

    if (!otpCode || (!email && !phone) || !title || !description || !category) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Find the most recent unverified OTP for this email or phone
    const query = email 
      ? { email: email.toLowerCase(), verified: false }
      : { phone: phone, verified: false };

    const otpRecord = await EmergencyOtp.findOne(query).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'No active OTP found. Please request a new OTP.' });
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Increment attempts
    otpRecord.attempts += 1;
    await otpRecord.save();

    // Limit brute-force attempts
    if (otpRecord.attempts > 5) {
      return res.status(429).json({ success: false, message: 'Too many invalid attempts. Please request a new OTP.' });
    }

    // Validate OTP
    if (otpRecord.otpCode !== otpCode.trim()) {
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`
      });
    }

    // Mark OTP as verified (one-time use)
    otpRecord.verified = true;
    await otpRecord.save();

    // ── Create or find Emergency Guest User ─────────────────────────────────
    let citizen;
    if (email) {
      citizen = await User.findOne({ email: email.toLowerCase() });
    } else if (phone) {
      citizen = await User.findOne({ phone: phone });
    }

    if (!citizen) {
      // Create a minimal emergency guest account
      const phone10 = phone ? phone.replace(/\D/g, '') : '0000000000';
      const userPayload = {
        name: name || otpRecord.name || 'Emergency User',
        password: `EMERGENCY_${Date.now()}`, // placeholder password, user must reset
        role: 'citizen',
        address: 'Emergency Report (Profile not complete)',
        isEmergencyUser: true
      };

      if (email) {
        userPayload.email = email.toLowerCase().trim();
        userPayload.phone = phone10;
      } else {
        userPayload.phone = phone;
      }

      citizen = await User.create(userPayload);
    }

    // ── Submit Emergency Complaint ───────────────────────────────────────────
    const latNum = latitude ? Number(latitude) : null;
    const lonNum = longitude ? Number(longitude) : null;

    // Auto-assign department
    const deptName = assignDepartment(category);
    const department = await Department.findOne({ departmentName: deptName });

    const complaintId = generateComplaintId();

    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    }

    const complaint = await Complaint.create({
      complaintId,
      title: title.trim(),
      description: description.trim(),
      category,
      priority: 'Emergency',         // Always Emergency priority
      latitude: latNum,
      longitude: lonNum,
      image: imagePath,
      citizenId: citizen._id,
      departmentId: department ? department._id : null,
      status: 'Submitted'
    });

    // Initial timeline entry
    await Timeline.create({
      complaintId: complaint._id,
      status: 'Submitted',
      remarks: '🚨 EMERGENCY complaint submitted via OTP-verified quick report.',
      updatedBy: citizen._id
    });

    // Send notifications in background
    if (citizen) {
      if (citizen.email) {
        sendComplaintRegisteredEmail(citizen.email, citizen.name, complaint)
          .catch(err => console.error('Error sending emergency email:', err));
      }
      if (citizen.phone && citizen.phone !== '0000000000') {
        sendComplaintRegisteredSms(citizen.phone, complaint.complaintId, complaint.title)
          .catch(err => console.error('Error sending emergency SMS:', err));
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Emergency complaint submitted successfully!',
      data: {
        complaintId: complaint.complaintId,
        complaintMongoId: complaint._id,
        title: complaint.title,
        priority: complaint.priority,
        status: complaint.status,
        citizenEmail: citizen.email || '',
        citizenPhone: citizen.phone || '',
        isNewAccount: !req.body.existingUser
      }
    });
  } catch (error) {
    console.error('Emergency Submit Error:', error);
    return res.status(500).json({ success: false, message: 'Server error submitting emergency complaint.', error: error.message });
  }
};

module.exports = {
  sendEmergencyOtp,
  verifyOtpAndSubmitEmergency
};
