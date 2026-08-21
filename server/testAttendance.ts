import { config } from 'dotenv';
config();
import connectDB from './src/config/db.config';
import { DaySession } from './src/modules/project/models/DaySession.model';

async function run() {
    await connectDB();
    const sessions = await DaySession.find().sort({ createdAt: -1 }).limit(10).lean();
    console.log(`Found ${sessions.length} sessions`);
    for (const session of sessions) {
        console.log(session);
    }
    process.exit(0);
}

run().catch(console.error);
