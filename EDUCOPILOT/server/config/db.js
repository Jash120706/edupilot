const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/educopilot';

  const connectionOptions = {
    serverSelectionTimeoutMS: 5000,
    family: 4, // Force IPv4
    directConnection: true,
  };

  try {
    const conn = await mongoose.connect(uri, connectionOptions);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.warn(`[Database] Initial connection attempt with directConnection failed (${error.message}). Retrying standard connect...`);
    try {
      const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, family: 4 });
      console.log(`[Database] MongoDB Connected (Standard): ${conn.connection.host}`);
      return true;
    } catch (fallbackErr) {
      console.error(`[Database] MongoDB connection failed: ${fallbackErr.message}`);
      return false;
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB connection lost. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database] MongoDB reconnected successfully.');
});

module.exports = connectDB;

