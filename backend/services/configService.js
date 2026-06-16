const SystemConfig = require('../models/SystemConfig');

// In-memory config for Mock DB fallback mode
let memoryConfig = {
  maxCallDurationSeconds: 300, // 5 minutes default
  defaultTrialsCount: 5
};

const configService = {
  getConfig: async () => {
    if (global.isMockDB) {
      return { ...memoryConfig };
    }

    try {
      let config = await SystemConfig.findOne();
      if (!config) {
        // Create initial config doc if none exists
        config = new SystemConfig();
        await config.save();
      }
      return config;
    } catch (error) {
      console.error('Error fetching system config, using default:', error.message);
      return { maxCallDurationSeconds: 300, defaultTrialsCount: 5 };
    }
  },

  updateConfig: async ({ maxCallDurationSeconds, defaultTrialsCount }) => {
    const duration = parseInt(maxCallDurationSeconds);
    const trials = parseInt(defaultTrialsCount);

    if (global.isMockDB) {
      if (!isNaN(duration)) memoryConfig.maxCallDurationSeconds = duration;
      if (!isNaN(trials)) memoryConfig.defaultTrialsCount = trials;
      console.log(`[MockDB] Config updated: maxCallDurationSeconds=${memoryConfig.maxCallDurationSeconds}, defaultTrialsCount=${memoryConfig.defaultTrialsCount}`);
      return { ...memoryConfig };
    }

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig();
    }

    if (!isNaN(duration)) config.maxCallDurationSeconds = duration;
    if (!isNaN(trials)) config.defaultTrialsCount = trials;
    config.updatedAt = new Date();

    return await config.save();
  }
};

module.exports = configService;
