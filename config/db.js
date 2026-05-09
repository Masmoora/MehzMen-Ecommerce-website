import mongoose from 'mongoose';
import env from 'dotenv';
env.config();
import logger from '../logger.js';

const connectDB=async ()=>{
  try{
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('MongoDB connected successfully');

  }catch(error){
    logger.error('MongoDB connection error:', error.message);
    process.exit(1);

  }
};

export default connectDB;