const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const SupportVote = require('../models/SupportVote');
const Timeline = require('../models/Timeline');
const { getDistance, generateComplaintId, assignDepartment } = require('../utils/helpers');
const path = require('path');
const fs = require('fs');
const { sendComplaintRegisteredEmail, sendComplaintStatusUpdateEmail } = require('../utils/emailService');
const { sendComplaintRegisteredSms, sendComplaintStatusUpdateSms } = require('../utils/smsService');

/**
 * Helper to get duplicates for a category and coordinate
 */
const findDuplicateComplaints = async (category, latitude, longitude) => {
  // Find unresolved complaints of the same category
  const unresolvedComplaints = await Complaint.find({
    category,
    status: { $nin: ['Resolved', 'Closed', 'Rejected'] }
  });

  const duplicates = [];
  for (const comp of unresolvedComplaints) {
    const distance = getDistance(latitude, longitude, comp.latitude, comp.longitude);
    if (distance <= 100) {
      duplicates.push({
        complaint: comp,
        distance: Math.round(distance)
      });
    }
  }
  return duplicates;
};

/**
 * @desc    Dry run duplicate check
 * @route   POST /api/complaints/check-duplicate
 * @access  Private
 */
const checkDuplicate = async (req, res) => {
  try {
    const { category, latitude, longitude } = req.body;

    if (!category || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide category, latitude, and longitude' });
    }

    const duplicates = await findDuplicateComplaints(category, Number(latitude), Number(longitude));

    return res.status(200).json({
      success: true,
      hasDuplicate: duplicates.length > 0,
      duplicates
    });
  } catch (error) {
    console.error('Check Duplicate Error:', error);
    return res.status(500).json({ success: false, message: 'Server error check duplicate' });
  }
};

/**
 * @desc    Submit a new complaint
 * @route   POST /api/complaints
 * @access  Private (Citizen)
 */
const createComplaint = async (req, res) => {
  try {
    const { title, description, category, priority, latitude, longitude, bypassDuplicate } = req.body;

    if (!title || !description || !category || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const latNum = Number(latitude);
    const lonNum = Number(longitude);

    // Duplicate detection check (unless bypassed)
    if (bypassDuplicate !== 'true') {
      const duplicates = await findDuplicateComplaints(category, latNum, lonNum);
      if (duplicates.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Similar complaint already exists nearby.',
          duplicates
        });
      }
    }

    // Auto routing to Department
    const deptName = assignDepartment(category);
    const department = await Department.findOne({ departmentName: deptName });

    const complaintId = generateComplaintId();
    let imagePath = '';

    if (req.file) {
      // Relative path for client serving
      imagePath = `/uploads/${req.file.filename}`;
    }

    // Create the complaint
    const complaint = await Complaint.create({
      complaintId,
      title,
      description,
      category,
      priority: priority || 'Medium',
      latitude: latNum,
      longitude: lonNum,
      image: imagePath,
      citizenId: req.user._id,
      departmentId: department ? department._id : null,
      status: 'Submitted'
    });

    // Create initial timeline entry
    await Timeline.create({
      complaintId: complaint._id,
      status: 'Submitted',
      remarks: 'Complaint submitted to the system.',
      updatedBy: req.user._id
    });

    // Send notifications in background
    if (req.user) {
      if (req.user.email) {
        sendComplaintRegisteredEmail(req.user.email, req.user.name, complaint)
          .catch(err => console.error('Error sending registration email:', err));
      }
      if (req.user.phone) {
        sendComplaintRegisteredSms(req.user.phone, complaint.complaintId, complaint.title)
          .catch(err => console.error('Error sending registration SMS:', err));
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Create Complaint Error:', error);
    return res.status(500).json({ success: false, message: 'Server error submitting complaint', error: error.message });
  }
};

/**
 * @desc    Get all complaints (filtered, paginated, sorted)
 * @route   GET /api/complaints
 * @access  Private
 */
const getComplaints = async (req, res) => {
  try {
    const { status, category, priority, keyword, departmentId, sortBy, order, page, limit } = req.query;

    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by priority
    if (priority) {
      query.priority = priority;
    }

    // Filter by department
    if (departmentId) {
      query.departmentId = departmentId;
    }

    // Keyword Search (ID, Title, Description)
    if (keyword) {
      query.$or = [
        { complaintId: { $regex: keyword, $options: 'i' } },
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } }
      ];
    }

    // Authority filter: If user is an authority, only show complaints for their department
    if (req.user.role === 'authority') {
      const dept = await Department.findOne({ officerEmail: req.user.email });
      if (dept) {
        query.departmentId = dept._id;
      } else {
        // If authority doesn't have an assigned department, return empty
        return res.status(200).json({ success: true, data: [], pagination: { total: 0, pages: 0, page: 1, limit: 10 } });
      }
    }

    // Pagination setup
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skipNum = (pageNum - 1) * limitNum;

    // Sorting setup
    let sortQuery = { createdAt: -1 }; // default: newest first
    if (sortBy) {
      const sortOrder = order === 'asc' ? 1 : -1;
      sortQuery = { [sortBy]: sortOrder };
    }

    const total = await Complaint.countDocuments(query);
    const complaints = await Complaint.find(query)
      .populate('citizenId', 'name email phone')
      .populate('departmentId', 'departmentName officerName officerEmail')
      .sort(sortQuery)
      .skip(skipNum)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        total,
        pages: Math.ceil(total / limitNum),
        page: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Get Complaints Error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching complaints' });
  }
};

/**
 * @desc    Get current user's own complaints
 * @route   GET /api/complaints/my-complaints
 * @access  Private (Citizen)
 */
const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ citizenId: req.user._id })
      .populate('departmentId', 'departmentName officerName')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    console.error('Get My Complaints Error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching your complaints' });
  }
};

/**
 * @desc    Public complaint tracking by reference ID (no auth required)
 * @route   GET /api/complaints/track/:complaintId
 * @access  Public
 */
const trackComplaintPublic = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const mongoose = require('mongoose');

    let query = {};
    if (mongoose.Types.ObjectId.isValid(complaintId)) {
      query = { _id: complaintId };
    } else {
      query = { complaintId: complaintId.toUpperCase() };
    }

    // Search by the human-readable complaintId string (e.g. CIV-20240710-XXXXX) or MongoDB _id
    const complaint = await Complaint.findOne(query)
      .populate('departmentId', 'departmentName officerName officerEmail phone');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'No complaint found with this tracking ID. Please check the ID and try again.' });
    }

    // Get Timeline entries
    const timeline = await Timeline.find({ complaintId: complaint._id })
      .populate('updatedBy', 'name role')
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.complaintId,
        title: complaint.title,
        description: complaint.description,
        category: complaint.category,
        priority: complaint.priority,
        status: complaint.status,
        supportCount: complaint.supportCount,
        latitude: complaint.latitude,
        longitude: complaint.longitude,
        createdAt: complaint.createdAt,
        departmentId: complaint.departmentId,
        image: complaint.image,
        beforeImage: complaint.beforeImage,
        afterImage: complaint.afterImage,
        remarks: complaint.remarks,
        _id: complaint._id
      },
      timeline
    });
  } catch (error) {
    console.error('Public Track Error:', error);
    return res.status(500).json({ success: false, message: 'Server error tracking complaint' });
  }
};

/**
 * @desc    Get complaint by MongoDB ID (includes Timeline and support check)
 * @route   GET /api/complaints/:id
 * @access  Private
 */
const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('citizenId', 'name email phone')
      .populate('departmentId', 'departmentName officerName officerEmail phone');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Get Timeline entries
    const timeline = await Timeline.find({ complaintId: complaint._id })
      .populate('updatedBy', 'name role')
      .sort({ createdAt: 1 });

    // Check if current user supported this complaint
    const hasSupported = await SupportVote.exists({
      userId: req.user._id,
      complaintId: complaint._id
    });

    return res.status(200).json({
      success: true,
      data: complaint,
      timeline,
      hasSupported: !!hasSupported
    });
  } catch (error) {
    console.error('Get Complaint Details Error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving details' });
  }
};

/**
 * @desc    Support an existing unresolved complaint
 * @route   POST /api/complaints/:id/support
 * @access  Private (Citizen)
 */
const supportComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Cannot support resolved/closed/rejected complaints
    if (['Resolved', 'Closed', 'Rejected'].includes(complaint.status)) {
      return res.status(400).json({ success: false, message: 'Cannot support an already resolved or closed complaint' });
    }

    // Check if already voted
    const alreadyVoted = await SupportVote.findOne({
      userId: req.user._id,
      complaintId: complaint._id
    });

    if (alreadyVoted) {
      return res.status(400).json({ success: false, message: 'You have already supported this complaint' });
    }

    // Create Vote
    await SupportVote.create({
      userId: req.user._id,
      complaintId: complaint._id
    });

    // Increment Support Count
    complaint.supportCount += 1;
    await complaint.save();

    // Create timeline update
    await Timeline.create({
      complaintId: complaint._id,
      status: complaint.status,
      remarks: `Complaint received support from a citizen. (Total Supports: ${complaint.supportCount})`,
      updatedBy: req.user._id
    });

    return res.status(200).json({
      success: true,
      message: 'Support registered successfully',
      supportCount: complaint.supportCount
    });
  } catch (error) {
    console.error('Support Complaint Error:', error);
    return res.status(500).json({ success: false, message: 'Server error supporting complaint' });
  }
};

/**
 * @desc    Update complaint status & remarks & images (Authority / Admin)
 * @route   PUT /api/complaints/:id/status
 * @access  Private (Authority or Admin)
 */
const updateComplaintStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const complaint = await Complaint.findById(req.params.id).populate('citizenId');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Verify authority is from the correct department
    if (req.user.role === 'authority') {
      const dept = await Department.findOne({ officerEmail: req.user.email });
      if (!dept || !complaint.departmentId || complaint.departmentId.toString() !== dept._id.toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized. You can only manage complaints assigned to your department.' });
      }
    }

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const oldStatus = complaint.status;

    // Save changes
    complaint.status = status;
    if (remarks !== undefined) {
      complaint.remarks = remarks;
    }

    // Handle uploaded file(s)
    if (req.files) {
      if (req.files.beforeImage && req.files.beforeImage[0]) {
        complaint.beforeImage = `/uploads/${req.files.beforeImage[0].filename}`;
      }
      if (req.files.afterImage && req.files.afterImage[0]) {
        complaint.afterImage = `/uploads/${req.files.afterImage[0].filename}`;
      }
    }

    await complaint.save();

    // Create Timeline entry
    await Timeline.create({
      complaintId: complaint._id,
      status,
      remarks: remarks || `Status updated to ${status}.`,
      updatedBy: req.user._id
    });

    // Send notifications in background
    if (complaint.citizenId) {
      const citizen = complaint.citizenId;
      if (citizen.email) {
        sendComplaintStatusUpdateEmail(citizen.email, citizen.name, complaint, oldStatus, status, remarks)
          .catch(err => console.error('Error sending status email:', err));
      }
      if (citizen.phone) {
        sendComplaintStatusUpdateSms(citizen.phone, complaint.complaintId, complaint.title, status, remarks)
          .catch(err => console.error('Error sending status SMS:', err));
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Complaint updated successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Update Status Error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating status', error: error.message });
  }
};

/**
 * @desc    Submit citizen rating & feedback for a resolved/closed complaint
 * @route   POST /api/complaints/:id/feedback
 * @access  Private (Citizen)
 */
const submitFeedback = async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Verify rating value
    const ratingNum = Number(rating);
    if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'Please provide a valid rating between 1 and 5' });
    }

    // Only the citizen who submitted the complaint can leave feedback
    if (complaint.citizenId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized. Only the owner citizen can leave feedback.' });
    }

    // Check status - must be Resolved or Closed
    if (!['Resolved', 'Closed'].includes(complaint.status)) {
      return res.status(400).json({ success: false, message: 'Feedback can only be submitted for resolved or closed complaints' });
    }

    complaint.rating = ratingNum;
    if (feedback !== undefined) {
      complaint.feedback = feedback.trim();
    }

    await complaint.save();

    // Create Timeline entry
    await Timeline.create({
      complaintId: complaint._id,
      status: complaint.status,
      remarks: `Citizen submitted feedback and rated the service: ${ratingNum}/5 stars. Remarks: "${feedback || ''}"`,
      updatedBy: req.user._id
    });

    return res.status(200).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Submit Feedback Error:', error);
    return res.status(500).json({ success: false, message: 'Server error submitting feedback', error: error.message });
  }
};

module.exports = {
  checkDuplicate,
  createComplaint,
  getComplaints,
  getMyComplaints,
  trackComplaintPublic,
  getComplaintById,
  supportComplaint,
  updateComplaintStatus,
  submitFeedback
};
