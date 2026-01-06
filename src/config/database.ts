import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  try {
    // const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arrow-crossword';
    const mongoUri = 'mongodb://localhost:27017/arrow-crossword';
    
    await mongoose.connect(mongoUri);
    
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};