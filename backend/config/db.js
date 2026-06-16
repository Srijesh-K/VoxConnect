const mongoose = require('mongoose');

global.isMockDB = false;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voxconnect', {
      serverSelectionTimeoutMS: 3000 // Timeout fast if DB is not running
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    global.isMockDB = false;
  } catch (error) {
    console.warn('====================================================================');
    console.warn('WARNING: Failed to connect to MongoDB.');
    console.warn(`Error: ${error.message}`);
    console.warn('VoxConnect will fall back to IN-MEMORY DATABASE MODE for this session.');
    console.warn('Data will not persist if the server restarts.');
    console.warn('====================================================================');
    global.isMockDB = true;
  }
};

module.exports = connectDB;
