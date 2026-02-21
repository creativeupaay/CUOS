import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../modules/auth/models/User.model';

dotenv.config();

async function reset() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cuos');
    const user = await User.findOne({ email: 'admin@creativeupaay.com' });
    if (user) {
        user.password = 'Admin@123';
        await user.save();
        console.log('Password reset successfully to Admin@123');
    } else {
        console.log('Admin user not found');
    }
    process.exit(0);
}

reset();
