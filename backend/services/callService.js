const Call = require('../models/Call');
const userService = require('./userService');

// In-memory call store for fallback mode
const memoryCalls = [];

const generateMockId = () => {
  return 'mockcall' + Math.random().toString(16).substring(2, 10) + 'ab' + Math.random().toString(16).substring(2, 14);
};

const callService = {
  createCall: async ({ callerId, recipientId, recipientPhoneNumber }) => {
    if (global.isMockDB) {
      const caller = await userService.findById(callerId);
      const recipient = await userService.findById(recipientId);
      
      const newCall = {
        _id: generateMockId(),
        caller: callerId,
        recipient: recipientId,
        recipientPhoneNumber,
        duration: 0,
        status: 'failed',
        startTime: null,
        endTime: null,
        createdAt: new Date(),
        // Mock populated fields for dashboard ease
        callerDetails: caller,
        recipientDetails: recipient
      };
      
      memoryCalls.push(newCall);
      console.log(`[MockDB] Call record created: ${newCall._id}`);
      return { ...newCall };
    }

    const call = new Call({
      caller: callerId,
      recipient: recipientId,
      recipientPhoneNumber,
      status: 'failed'
    });
    
    return await call.save();
  },

  connectCall: async (callId) => {
    const now = new Date();
    if (global.isMockDB) {
      const index = memoryCalls.findIndex(c => c._id === callId);
      if (index !== -1) {
        memoryCalls[index].status = 'connected';
        memoryCalls[index].startTime = now;
        console.log(`[MockDB] Call ${callId} status updated to connected at ${now}`);
        return { ...memoryCalls[index] };
      }
      return null;
    }

    return await Call.findByIdAndUpdate(
      callId,
      { status: 'connected', startTime: now },
      { new: true }
    );
  },

  endCall: async (callId, duration, status) => {
    const now = new Date();
    if (global.isMockDB) {
      const index = memoryCalls.findIndex(c => c._id === callId);
      if (index !== -1) {
        memoryCalls[index].status = status;
        memoryCalls[index].duration = duration;
        memoryCalls[index].endTime = now;
        console.log(`[MockDB] Call ${callId} ended. Status: ${status}, Duration: ${duration}s`);
        return { ...memoryCalls[index] };
      }
      return null;
    }

    return await Call.findByIdAndUpdate(
      callId,
      { status, duration, endTime: now },
      { new: true }
    );
  },

  getCallHistory: async (userId) => {
    if (global.isMockDB) {
      // Find all calls where user is caller or recipient
      const userCalls = memoryCalls
        .filter(c => c.caller === userId || c.recipient === userId)
        .map(c => {
          // Ensure structure resembles populated Mongoose document
          return {
            ...c,
            caller: c.callerDetails,
            recipient: c.recipientDetails
          };
        });
      
      // Sort by createdAt desc
      return userCalls.sort((a, b) => b.createdAt - a.createdAt);
    }

    return await Call.find({
      $or: [{ caller: userId }, { recipient: userId }]
    })
      .populate('caller', 'phoneNumber')
      .populate('recipient', 'phoneNumber')
      .sort({ createdAt: -1 });
  }
};

module.exports = callService;
