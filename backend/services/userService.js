const User = require('../models/User');
const configService = require('./configService');

// In-memory user store for fallback mode
const memoryUsers = [];

// Helper to generate a mock Object ID format string
const generateMockId = () => {
  return 'mock' + Math.random().toString(16).substring(2, 10) + '5f' + Math.random().toString(16).substring(2, 14);
};

const userService = {
  findByPhoneNumber: async (phoneNumber) => {
    const cleanNumber = phoneNumber.trim();
    if (global.isMockDB) {
      const found = memoryUsers.find(u => u.phoneNumber === cleanNumber);
      return found ? { ...found } : null;
    }
    return await User.findOne({ phoneNumber: cleanNumber });
  },

  findById: async (id) => {
    if (global.isMockDB) {
      const found = memoryUsers.find(u => u._id === id);
      return found ? { ...found } : null;
    }
    return await User.findById(id);
  },

  createUser: async (phoneNumber) => {
    const cleanNumber = phoneNumber.trim();
    
    // Fetch default trials count from config
    const config = await configService.getConfig();
    const trials = config.defaultTrialsCount || 5;

    if (global.isMockDB) {
      const newUser = {
        _id: generateMockId(),
        phoneNumber: cleanNumber,
        trialsRemaining: trials,
        totalMinutesUsed: 0,
        createdAt: new Date()
      };
      memoryUsers.push(newUser);
      console.log(`[MockDB] User created: ${cleanNumber} with ${trials} trials`);
      return { ...newUser };
    }
    
    const user = new User({ 
      phoneNumber: cleanNumber,
      trialsRemaining: trials
    });
    return await user.save();
  },

  decrementTrials: async (userId) => {
    if (global.isMockDB) {
      const userIndex = memoryUsers.findIndex(u => u._id === userId);
      if (userIndex !== -1) {
        if (memoryUsers[userIndex].trialsRemaining > 0) {
          memoryUsers[userIndex].trialsRemaining -= 1;
        }
        console.log(`[MockDB] Trials decremented for user ${userId}. Remaining: ${memoryUsers[userIndex].trialsRemaining}`);
        return { ...memoryUsers[userIndex] };
      }
      return null;
    }
    
    return await User.findByIdAndUpdate(
      userId,
      { $inc: { trialsRemaining: -1 } },
      { new: true, runValidators: true }
    );
  },

  incrementMinutes: async (userId, seconds) => {
    const minutes = parseFloat((seconds / 60).toFixed(2));
    if (global.isMockDB) {
      const userIndex = memoryUsers.findIndex(u => u._id === userId);
      if (userIndex !== -1) {
        memoryUsers[userIndex].totalMinutesUsed = parseFloat(
          (memoryUsers[userIndex].totalMinutesUsed + minutes).toFixed(2)
        );
        console.log(`[MockDB] Added ${minutes} mins to user ${userId}. Total: ${memoryUsers[userIndex].totalMinutesUsed}`);
        return { ...memoryUsers[userIndex] };
      }
      return null;
    }

    return await User.findByIdAndUpdate(
      userId,
      { $inc: { totalMinutesUsed: minutes } },
      { new: true }
    );
  },

  // ADMIN METHODS
  getAllUsers: async () => {
    if (global.isMockDB) {
      // Return clones of memoryUsers sorted by createdAt desc
      return [...memoryUsers].sort((a, b) => b.createdAt - a.createdAt);
    }
    return await User.find({}).sort({ createdAt: -1 });
  },

  setTrials: async (userId, trialsCount) => {
    const trials = parseInt(trialsCount);
    if (global.isMockDB) {
      const userIndex = memoryUsers.findIndex(u => u._id === userId);
      if (userIndex !== -1) {
        memoryUsers[userIndex].trialsRemaining = trials;
        console.log(`[MockDB-Admin] Set trials to ${trials} for user ${userId}`);
        return { ...memoryUsers[userIndex] };
      }
      return null;
    }
    return await User.findByIdAndUpdate(
      userId,
      { trialsRemaining: trials },
      { new: true }
    );
  },

  deleteUser: async (userId) => {
    if (global.isMockDB) {
      const index = memoryUsers.findIndex(u => u._id === userId);
      if (index !== -1) {
        const deleted = memoryUsers.splice(index, 1)[0];
        console.log(`[MockDB-Admin] User deleted: ${deleted.phoneNumber}`);
        return deleted;
      }
      return null;
    }
    return await User.findByIdAndDelete(userId);
  }
};

module.exports = userService;
