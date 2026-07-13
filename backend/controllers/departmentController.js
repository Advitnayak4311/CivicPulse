const Department = require('../models/Department');

/**
 * @desc    Get all departments
 * @route   GET /api/departments
 * @access  Public (or Private)
 */
const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find({});
    return res.status(200).json({ success: true, data: departments });
  } catch (error) {
    console.error('Get Departments Error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving departments' });
  }
};

/**
 * @desc    Create a new department
 * @route   POST /api/departments
 * @access  Private/Admin
 */
const createDepartment = async (req, res) => {
  try {
    const { departmentName, officerName, officerEmail, phone } = req.body;

    if (!departmentName || !officerName || !officerEmail || !phone) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const deptExists = await Department.findOne({ departmentName });
    if (deptExists) {
      return res.status(400).json({ success: false, message: 'Department with this name already exists' });
    }

    const department = await Department.create({
      departmentName,
      officerName,
      officerEmail,
      phone
    });

    return res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department
    });
  } catch (error) {
    console.error('Create Department Error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating department', error: error.message });
  }
};

/**
 * @desc    Delete a department
 * @route   DELETE /api/departments/:id
 * @access  Private/Admin
 */
const deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Unassign complaints that belong to this department
    const Complaint = require('../models/Complaint');
    await Complaint.updateMany({ departmentId: req.params.id }, { $set: { departmentId: null } });

    await Department.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Department "${dept.departmentName}" deleted successfully, and associated complaints unassigned.`
    });
  } catch (error) {
    console.error('Delete Department Error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting department', error: error.message });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  deleteDepartment
};

