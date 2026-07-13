const mongoose = require('mongoose');

const SupportVoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Enforce unique voting: a user can only vote for a specific complaint once
SupportVoteSchema.index({ userId: 1, complaintId: 1 }, { unique: true });

module.exports = mongoose.model('SupportVote', SupportVoteSchema);
