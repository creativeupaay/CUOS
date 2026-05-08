import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from "../utils/logger";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`MongoDB connection error: ${error.message}`);

      if (
        error.message.includes('queryTxt') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('EREFUSED')
      ) {
        logger.error(
          'MongoDB Atlas DNS lookup failed. If you are using a mongodb+srv URL, check your internet/DNS/VPN/firewall settings or try a direct mongodb:// connection string from Atlas.'
        );
      }
    } else {
      logger.error(`Unexpected error: ${error}`);
    }

    process.exit(1);
  }
};

export default connectDB;
