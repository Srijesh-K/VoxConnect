const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
  maxCallDurationSeconds: {
    type: Number,
    default: 300,
    min: 5
  },
  defaultTrialsCount: {
    type: Number,
    default: 5,
    min: 1
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
