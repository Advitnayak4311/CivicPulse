const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const Timeline = require('../models/Timeline');

/**
 * @desc    Get all users (for Admin dashboard)
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
const getUsers = async (req, res) => {
  try {
    // Return all users, sorting by role and name
    const users = await User.find({ role: { $ne: 'admin' } }).select('-password').sort({ role: 1, name: 1 });
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Get Users Admin Error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving users' });
  }
};

/**
 * @desc    Deactivate or Activate user account
 * @route   PUT /api/admin/users/:id/toggle-status
 * @access  Private/Admin
 */
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate admin accounts' });
    }

    user.isActive = !user.isActive;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User account has been ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { _id: user._id, name: user.name, isActive: user.isActive }
    });
  } catch (error) {
    console.error('Toggle User Status Error:', error);
    return res.status(500).json({ success: false, message: 'Server error toggling user status' });
  }
};

/**
 * @desc    Register a new Government Authority
 * @route   POST /api/admin/authorities
 * @access  Private/Admin
 */
const createAuthority = async (req, res) => {
  try {
    const { name, email, phone, password, address, departmentId } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { phone }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'A user with this email or phone already exists' });
    }

    // Create user with 'authority' role
    const authority = await User.create({
      name,
      email,
      phone,
      password,
      address,
      role: 'authority'
    });

    // If departmentId is provided, we can link them.
    // In our design, routing happens by authority email matching department's officerEmail.
    // If the Admin specified a department, let's verify it and ensure the officerEmail matches.
    if (departmentId) {
      const dept = await Department.findById(departmentId);
      if (dept) {
        dept.officerEmail = email;
        dept.officerName = name;
        await dept.save();
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Government Authority registered successfully',
      data: {
        _id: authority._id,
        name: authority.name,
        email: authority.email,
        phone: authority.phone,
        role: authority.role
      }
    });
  } catch (error) {
    console.error('Create Authority Error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating authority', error: error.message });
  }
};

/**
 * @desc    Delete a complaint (e.g. fake, duplicate, abusive content)
 * @route   DELETE /api/admin/complaints/:id
 * @access  Private/Admin
 */
const deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Remove associated votes and timeline logs
    await SupportVote.deleteMany({ complaintId: complaint._id });
    await Timeline.deleteMany({ complaintId: complaint._id });

    // Delete complaint
    await Complaint.findByIdAndDelete(req.params.id);

    return res.status(200).json({ success: true, message: 'Complaint and associated history deleted successfully' });
  } catch (error) {
    console.error('Delete Complaint Error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting complaint' });
  }
};

/**
 * @desc    Retrieve system dashboard analytics and aggregation charts
 * @route   GET /api/admin/analytics
 * @access  Private/Admin (or Private for shared dashboard views)
 */
const getAnalytics = async (req, res) => {
  try {
    // 1. Basic Stats
    const total = await Complaint.countDocuments({});
    const open = await Complaint.countDocuments({ status: { $in: ['Submitted', 'Verified', 'Assigned', 'Under Review', 'Repair Started', 'Repair In Progress'] } });
    const resolved = await Complaint.countDocuments({ status: { $in: ['Resolved', 'Closed'] } });
    const rejected = await Complaint.countDocuments({ status: 'Rejected' });

    // Today's complaints count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = await Complaint.countDocuments({ createdAt: { $gte: startOfToday } });

    // 2. Category distribution
    const categoryData = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // 3. Priority distribution
    const priorityData = await Complaint.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // 4. Status distribution
    const statusData = await Complaint.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // 5. Department wise performance (Total vs Resolved)
    const departments = await Department.find({});
    const departmentPerformance = [];

    for (const dept of departments) {
      const totalDept = await Complaint.countDocuments({ departmentId: dept._id });
      const resolvedDept = await Complaint.countDocuments({
        departmentId: dept._id,
        status: { $in: ['Resolved', 'Closed'] }
      });
      departmentPerformance.push({
        departmentName: dept.departmentName,
        total: totalDept,
        resolved: resolvedDept,
        officer: dept.officerName
      });
    }

    // 6. Monthly trend data (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyTrends = await Complaint.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format monthly trend output for ease of chart plotting
    const monthlyFormatted = monthlyTrends.map(item => {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return {
        label: `${monthNames[item._id.month - 1]} ${item._id.year}`,
        count: item.count
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalComplaints: total,
          openComplaints: open,
          resolvedComplaints: resolved,
          rejectedComplaints: rejected,
          todaysComplaints: today
        },
        categoryWise: categoryData,
        priorityWise: priorityData,
        statusWise: statusData,
        departmentWise: departmentPerformance,
        monthlyTrends: monthlyFormatted
      }
    });
  } catch (error) {
    console.error('Get Analytics Error:', error);
    return res.status(500).json({ success: false, message: 'Server error compiling dashboard analytics' });
  }
};

/**
 * @desc    Admin: Verify a complaint and optionally reassign department
 * @route   PUT /api/admin/complaints/:id/verify
 * @access  Private/Admin
 */
const verifyAndAssignComplaint = async (req, res) => {
  try {
    const { departmentId, remarks } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Only verify if not already past verification stage
    const alreadyProgressed = ['Resolved', 'Closed', 'Rejected', 'Repair In Progress', 'Repair Started'].includes(complaint.status);
    if (!alreadyProgressed) {
      complaint.status = 'Verified';
    }

    // Reassign department if provided
    if (departmentId) {
      const dept = await Department.findById(departmentId);
      if (!dept) {
        return res.status(404).json({ success: false, message: 'Department not found' });
      }
      complaint.departmentId = departmentId;
    }

    if (remarks) {
      complaint.remarks = remarks;
    }

    await complaint.save();

    // Log timeline entry
    await Timeline.create({
      complaintId: complaint._id,
      status: complaint.status,
      remarks: remarks || 'Complaint verified and department confirmed by admin.',
      updatedBy: req.user._id
    });

    // Return populated complaint
    const populated = await Complaint.findById(complaint._id)
      .populate('departmentId', 'departmentName officerName officerEmail phone')
      .populate('citizenId', 'name email phone');

    return res.status(200).json({
      success: true,
      message: `Complaint verified and ${departmentId ? 'department reassigned' : 'department confirmed'} successfully.`,
      data: populated
    });
  } catch (error) {
    console.error('Verify & Assign Error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying complaint', error: error.message });
  }
};

/**
 * @desc    Admin: Escalate a complaint to Emergency status
 * @route   PUT /api/admin/complaints/:id/escalate
 * @access  Private/Admin
 */
const escalateComplaint = async (req, res) => {
  try {
    const Complaint = require('../models/Complaint');
    const Timeline = require('../models/Timeline');
    const Department = require('../models/Department');
    const { sendComplaintEscalatedEmail } = require('../utils/emailService');

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Set priority to Emergency
    complaint.priority = 'Emergency';
    await complaint.save();

    // Log escalation in Timeline
    await Timeline.create({
      complaintId: complaint._id,
      status: complaint.status,
      remarks: '🚨 COMPLAINT ESCALATED: Priority increased to Emergency by System Administrator.',
      updatedBy: req.user._id
    });

    // Populate department info to send email
    const populated = await Complaint.findById(complaint._id)
      .populate('departmentId', 'departmentName officerName officerEmail phone')
      .populate('citizenId', 'name email phone');

    if (populated.departmentId && populated.departmentId.officerEmail) {
      sendComplaintEscalatedEmail(
        populated.departmentId.officerEmail,
        populated.departmentId.officerName,
        populated
      ).catch(err => console.error('Failed to send escalation email:', err));
    }

    return res.status(200).json({
      success: true,
      message: `Complaint ${complaint.complaintId} successfully escalated to EMERGENCY priority.`,
      data: populated
    });
  } catch (error) {
    console.error('Escalate Complaint Error:', error);
    return res.status(500).json({ success: false, message: 'Server error escalating complaint', error: error.message });
  }
};

module.exports = {
  getUsers,
  toggleUserStatus,
  createAuthority,
  deleteComplaint,
  getAnalytics,
  verifyAndAssignComplaint,
  escalateComplaint
};

