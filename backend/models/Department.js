const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  departmentName: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true
  },
  officerName: {
    type: String,
    required: [true, 'Officer name is required'],
    trim: true
  },
  officerEmail: {
    type: String,
    required: [true, 'Officer email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Department phone is required'],
    trim: true
  }
});

module.exports = mongoose.model('Department', DepartmentSchema);
