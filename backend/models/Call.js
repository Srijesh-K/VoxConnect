const mongoose = require('mongoose');

const CallSchema = new mongoose.Schema({
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientPhoneNumber: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    default: 0 // in seconds
  },
  status: {
    type: String,
    enum: ['connected', 'completed', 'missed', 'rejected', 'failed'],
    default: 'failed'
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Call', CallSchema);
