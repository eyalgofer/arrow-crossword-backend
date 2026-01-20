import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  try {
    // Log environment variables for debugging (mask sensitive values)
    console.log('🔍 Database connection check:');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? `${process.env.MONGODB_URI.substring(0, 20)}...` : 'NOT SET');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   Available env vars with MONGODB:', Object.keys(process.env).filter(k => k.includes('MONGO')).join(', ') || 'none');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arrow-crossword';
    
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable is not set!');
      console.error('   Falling back to default: mongodb://localhost:27017/arrow-crossword');
      console.error('   This will fail in production. Check AWS Secrets Manager configuration.');
    }
    
    console.log(`🔌 Connecting to MongoDB: ${mongoUri.substring(0, 30)}...`);
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