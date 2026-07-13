const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper function to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d' // Token valid for 30 days
  });
};

/**
 * @desc    Register a new citizen user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password, address } = req.body;

    // Validate request body: Name, Password, and at least one contact method
    if (!name || (!email && !phone) || !password) {
      return res.status(400).json({ success: false, message: 'Name, password, and at least one contact method (Email or Phone) are required.' });
    }

    // Check if user already exists (email)
    if (email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'User with this email already exists' });
      }
    }

    // Check if user already exists (phone)
    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
      }
    }

    // Create user (role defaults to citizen)
    const user = await User.create({
      name,
      email: email || undefined,
      phone: phone || undefined,
      password,
      address,
      role: 'citizen'
    });

    if (user) {
      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          address: user.address,
          token: generateToken(user._id)
        }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid user data received' });
    }
  } catch (error) {
    console.error('Register Error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body; // 'email' holds email OR phone number

    // Validate fields
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email or phone number, and password' });
    }

    const identifier = email.trim();

    // Find user by email OR phone number
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier }
      ]
    });

    // Check if user exists and is active
    if (!user) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'Account not found. Please register first.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account has been deactivated' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.address,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
  }
};

/**
 * @desc    Get user profile details
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      return res.status(200).json({ success: true, data: user });
    } else {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Get Profile Error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving profile' });
  }
};

const EmergencyOtp = require('../models/EmergencyOtp');
const { sendOtpEmail, sendForgotPasswordEmail } = require('../utils/emailService');
const { sendOtpSms } = require('../utils/smsService');

/**
 * @desc    Send OTP to user for changing password or verifying identity
 * @route   POST /api/auth/send-otp
 * @access  Private
 */
const sendProfileOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const email = user.email;
    const phone = user.phone;

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'No contact method configured for this user.' });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clear previous unverified OTPs
    if (email) {
      await EmergencyOtp.deleteMany({ email, verified: false });
    } else {
      await EmergencyOtp.deleteMany({ phone, verified: false });
    }

    // Save to database
    await EmergencyOtp.create({
      name: user.name,
      email: email || undefined,
      phone: phone || undefined,
      otpCode: otp,
      expiresAt
    });

    // Send notifications
    if (email) {
      await sendOtpEmail(email, user.name, otp);
    } else {
      await sendOtpSms(phone, otp);
    }

    const target = email || phone;
    const isDemoMode = (!process.env.EMAIL_USER && email) || (!process.env.TWILIO_ACCOUNT_SID && phone);

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${target}.${isDemoMode ? ' [DEMO MODE]' : ''}`,
      otp: isDemoMode ? otp : undefined
    });
  } catch (error) {
    console.error('Send profile OTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error sending verification OTP.' });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;
      user.address = req.body.address || user.address;
      user.preferredLanguage = req.body.preferredLanguage || user.preferredLanguage;

      if (req.file) {
        user.profilePhoto = `/uploads/${req.file.filename}`;
      }

      if (req.body.password) {
        const otpCode = req.body.otp;
        if (!otpCode) {
          return res.status(400).json({ success: false, message: 'OTP verification code is required to change password.' });
        }

        const identifier = user.email || user.phone;
        const otpRecord = await EmergencyOtp.findOne({
          $or: [
            { email: identifier },
            { phone: identifier }
          ],
          otpCode: otpCode.trim(),
          verified: false,
          expiresAt: { $gt: new Date() }
        });

        if (!otpRecord) {
          return res.status(400).json({ success: false, message: 'Invalid or expired OTP verification code.' });
        }

        // Verify and mark OTP as used
        otpRecord.verified = true;
        await otpRecord.save();

        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
          address: updatedUser.address,
          profilePhoto: updatedUser.profilePhoto,
          preferredLanguage: updatedUser.preferredLanguage,
          token: generateToken(updatedUser._id)
        }
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating profile', error: error.message });
  }
};

/**
 * @desc    Send OTP to email/phone for registration verification
 * @route   POST /api/auth/register/send-otp
 * @access  Public
 */
const registerSendOtp = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Please provide email or phone number.' });
    }

    // Check if user already exists
    if (email) {
      const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'User with this email already exists' });
      }
    }

    if (phone) {
      const phoneExists = await User.findOne({ phone: phone.trim() });
      if (phoneExists) {
        return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
      }
    }

    const emailOtpCode = String(Math.floor(100000 + Math.random() * 900000));
    const phoneOtpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    let emailSent = false;
    let phoneSent = false;
    let emailDeliveryFailed = false;
    let phoneDeliveryFailed = false;

    if (email) {
      await EmergencyOtp.create({
        name: name || 'Registering User',
        email: email.toLowerCase().trim(),
        otpCode: emailOtpCode,
        expiresAt
      });
      const emailResult = await sendOtpEmail(email.toLowerCase().trim(), name || 'Registering User', emailOtpCode);
      if (!emailResult || !emailResult.success) {
        emailDeliveryFailed = true;
      }
      emailSent = true;
    }

    if (phone) {
      await EmergencyOtp.create({
        name: name || 'Registering User',
        phone: phone.trim(),
        otpCode: phoneOtpCode,
        expiresAt
      });
      const phoneResult = await sendOtpSms(phone.trim(), phoneOtpCode);
      if (!phoneResult || !phoneResult.success) {
        phoneDeliveryFailed = true;
      }
      phoneSent = true;
    }

    const isDemoMode = !process.env.EMAIL_USER || emailDeliveryFailed || !process.env.TWILIO_ACCOUNT_SID || phoneDeliveryFailed;

    return res.status(200).json({
      success: true,
      message: (emailDeliveryFailed || phoneDeliveryFailed)
        ? `[DEMO MODE] Notification failed, but OTPs generated successfully.`
        : `OTP sent successfully.${isDemoMode ? ' [DEMO MODE: OTPs generated]' : ''}`,
      emailSent,
      phoneSent,
      demoEmailOtp: isDemoMode && email ? emailOtpCode : undefined,
      demoPhoneOtp: isDemoMode && phone ? phoneOtpCode : undefined
    });
  } catch (error) {
    console.error('Register Send OTP Error:', error);
    return res.status(500).json({ success: false, message: 'Server error sending verification OTP.' });
  }
};

/**
 * @desc    Verify OTP and complete registration
 * @route   POST /api/auth/register/verify
 * @access  Public
 */
const registerVerify = async (req, res) => {
  try {
    const { name, email, phone, password, address, emailOtp, phoneOtp } = req.body;

    if (!name || (!email && !phone) || !password) {
      return res.status(400).json({ success: false, message: 'Name, password, and at least one contact method (Email or Phone) are required.' });
    }

    if (email) {
      if (!emailOtp) {
        return res.status(400).json({ success: false, message: 'Email OTP is required.' });
      }
      const otpRecord = await EmergencyOtp.findOne({
        email: email.toLowerCase().trim(),
        otpCode: emailOtp.trim(),
        verified: false
      }).sort({ createdAt: -1 });

      if (!otpRecord || new Date() > otpRecord.expiresAt) {
        return res.status(400).json({ success: false, message: 'Invalid or expired Email OTP.' });
      }
      otpRecord.verified = true;
      await otpRecord.save();
    }

    if (phone) {
      if (!phoneOtp) {
        return res.status(400).json({ success: false, message: 'Phone OTP is required.' });
      }
      const otpRecord = await EmergencyOtp.findOne({
        phone: phone.trim(),
        otpCode: phoneOtp.trim(),
        verified: false
      }).sort({ createdAt: -1 });

      if (!otpRecord || new Date() > otpRecord.expiresAt) {
        return res.status(400).json({ success: false, message: 'Invalid or expired Phone OTP.' });
      }
      otpRecord.verified = true;
      await otpRecord.save();
    }

    // Double check email/phone uniqueness before create
    if (email) {
      const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
      if (emailExists) return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }
    if (phone) {
      const phoneExists = await User.findOne({ phone: phone.trim() });
      if (phoneExists) return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
    }

    // Create user (role defaults to citizen)
    const user = await User.create({
      name,
      email: email || undefined,
      phone: phone || undefined,
      password,
      address,
      role: 'citizen'
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.address,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    console.error('Register Verify Error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying and registering user.' });
  }
};

/**
 * @desc    Send OTP for forgot password verification
 * @route   POST /api/auth/forgot-password/send-otp
 * @access  Public
 */
const forgotPasswordSendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email address.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user registered with this email address.' });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clear previous unverified OTPs
    await EmergencyOtp.deleteMany({ email: email.toLowerCase(), verified: false });

    // Store OTP in database
    await EmergencyOtp.create({
      name: user.name,
      email: email.toLowerCase(),
      otpCode: otp,
      expiresAt
    });

    // Send email
    const emailResult = await sendForgotPasswordEmail(email.toLowerCase(), user.name, otp);
    const emailFailed = !emailResult || !emailResult.success;

    const isDemoMode = !process.env.EMAIL_USER || emailFailed;

    return res.status(200).json({
      success: true,
      message: emailFailed 
        ? `[DEMO MODE] Email delivery failed, but OTP generated successfully.`
        : `Verification code sent to your email.`,
      otp: isDemoMode ? otp : undefined
    });
  } catch (error) {
    console.error('Forgot Password Send OTP Error:', error);
    return res.status(500).json({ success: false, message: 'Server error sending verification code.' });
  }
};

/**
 * @desc    Reset password using verification OTP
 * @route   POST /api/auth/forgot-password/reset
 * @access  Public
 */
const forgotPasswordReset = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Email, verification code (OTP), and new password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user registered with this email address.' });
    }

    // Find and verify OTP record
    const otpRecord = await EmergencyOtp.findOne({
      email: email.toLowerCase(),
      otpCode: otp.trim(),
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    // Mark OTP as verified/used
    otpRecord.verified = true;
    await otpRecord.save();

    // Update password (pre-save hook hashes it)
    user.password = password;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    console.error('Forgot Password Reset Error:', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  sendProfileOtp,
  registerSendOtp,
  registerVerify,
  forgotPasswordSendOtp,
  forgotPasswordReset
};
