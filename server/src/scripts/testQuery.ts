import mongoose from 'mongoose';
import { env } from '../config/env.config';
import dotenv from 'dotenv';
dotenv.config();

// Need to dynamically import to ensure env vars are loaded before model starts
async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cuos');
    const { Client } = await import('../modules/client/models/Client.model');
    const clients = await Client.find({}).sort({createdAt: -1}).limit(2).populate({
        path: 'createdBy',
        populate: { path: 'role' }
    });
    console.log(clients.map((c: any) => ({ 
        id: c._id, 
        name: c.name, 
        partnerId: c.partnerId, 
        createdBy: {
            email: c.createdBy?.email,
            role: c.createdBy?.role?.name
        }
    })));
    process.exit();
}
run();
