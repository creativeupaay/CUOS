import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Reimbursement } from '../modules/hrms/models/Reimbursement.model';
import { Expense } from '../modules/finance/models/Expense.model';
import { ExpenseService } from '../modules/finance/services/expense.service';

async function run() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('Connected.');

        // Find all paid reimbursements
        const paidReimbursements = await Reimbursement.find({ status: 'paid' }).exec();
        console.log(`Found ${paidReimbursements.length} paid reimbursements.`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const reimbursement of paidReimbursements) {
            // Check if an expense already exists for this reimbursement
            const existingExpense = await Expense.findOne({ reimbursementId: reimbursement._id });
            
            if (existingExpense) {
                console.log(`Skipping Claim ID ${reimbursement.claimId} - Expense already exists.`);
                skipCount++;
                continue;
            }

            // Also check by description fallback in case it was synced but lacks the ID link
            const fallbackExpense = await Expense.findOne({ 
                description: `Reimbursement: ${reimbursement.title} (Claim ID: ${reimbursement.claimId})` 
            });

            if (fallbackExpense) {
                console.log(`Found existing expense for ${reimbursement.claimId} by description. Linking ID...`);
                fallbackExpense.reimbursementId = reimbursement._id;
                await fallbackExpense.save();
                successCount++;
                continue;
            }

            console.log(`Creating missing expense for Claim ID: ${reimbursement.claimId}...`);
            
            try {
                // Find who paid it (the last actor in the approval timeline or activity log)
                let adminName = 'System (Backfill)';
                let adminUserId = reimbursement.employeeId; // Fallback to employee if admin unknown

                const paidLog = reimbursement.activityLog.find(log => log.action === 'Payment marked');
                if (paidLog) {
                    adminName = paidLog.actorName;
                    adminUserId = paidLog.actorId;
                }

                // Try to extract payment method from somewhere, default to 'cash' if unknown for old records
                // since they weren't stored explicitly on the Reimbursement model
                let paymentMethod: any = 'cash';
                let sourceAccountKey: any = 'cash';

                await ExpenseService.create({
                    date: (reimbursement as any).paidAt || reimbursement.updatedAt,
                    description: `Reimbursement: ${reimbursement.title} (Claim ID: ${reimbursement.claimId})`,
                    category: 'Reimbursements',
                    level: 'company',
                    type: 'variable',
                    amount: reimbursement.amount,
                    employeeId: reimbursement.employeeId,
                    reimbursementId: reimbursement._id,
                    paidBy: adminName,
                    sourceAccountKey: sourceAccountKey,
                    paymentMethod: paymentMethod,
                    notes: 'Auto-synced from HRMS Reimbursements (Backfill).',
                    createdBy: adminUserId,
                } as any);

                successCount++;
                console.log(`Successfully synced Claim ID: ${reimbursement.claimId}`);
            } catch (err) {
                errorCount++;
                console.error(`Failed to sync Claim ID: ${reimbursement.claimId}`, err);
            }
        }

        console.log('\n--- Backfill Summary ---');
        console.log(`Total Paid Claims: ${paidReimbursements.length}`);
        console.log(`Successfully Synced/Linked: ${successCount}`);
        console.log(`Skipped (Already Exists): ${skipCount}`);
        console.log(`Errors: ${errorCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

run();
