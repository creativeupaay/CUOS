import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

mongoose.connect(process.env.MONGO_URI as string).then(async () => {
    const Meeting = mongoose.model('Meeting', new mongoose.Schema({}, { strict: false }));
    const meetings = await Meeting.find({}).lean();
    console.log('All meeting titles in DB:');
    meetings.forEach((m: any) => console.log('- ' + m.title));
    process.exit(0);
}).catch(console.error);
