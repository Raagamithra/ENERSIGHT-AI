import mongoose from 'mongoose';

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/enerSightAI';

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    console.warn('MongoDB connection failed, continuing in demo mode.', error.message);
    return false;
  }
};
