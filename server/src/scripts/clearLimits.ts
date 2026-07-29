import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Reimbursement } from '../modules/hrms/models/Reimbursement.model';

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        
        // Find all reimbursements that have a policy flag with "limit" in the message
        const reimbursements = await Reimbursement.find({ 
            'policyFlags.message': { $regex: /limit/i } 
        });

        console.log(`Found ${reimbursements.length} reimbursements with old limit flags.`);

        for (const r of reimbursements) {
            // Filter out flags that contain 'limit' (case insensitive)
            r.policyFlags = r.policyFlags.filter(
                f => !f.message.toLowerCase().includes('limit')
            );
            await r.save();
        }

        console.log('Successfully cleaned up old limit flags.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
