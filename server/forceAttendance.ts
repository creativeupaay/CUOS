import { config } from 'dotenv';
config();
import connectDB from './src/config/db.config';
import { runAutoAttendanceCheck } from './src/modules/notification/jobs/autoAttendance.job';

async function run() {
    await connectDB();
    console.log('Running auto attendance check manually...');
    await runAutoAttendanceCheck();
    console.log('Done!');
    process.exit(0);
}

run().catch(console.error);
