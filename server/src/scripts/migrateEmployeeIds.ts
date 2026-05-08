import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { Employee } from '../modules/hrms/models/Employee.model';
import { logger } from "../utils/logger";

async function generateOfflineId(year: number, nextIndex: number): Promise<string> {
    const nextCount = (nextIndex % 99) + 1;
    const nextGroup = 4 + Math.floor(nextIndex / 99);
    return `EID${year}${nextGroup.toString().padStart(2, '0')}${nextCount.toString().padStart(2, '0')}`;
}

async function migrate() {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI as string);
    logger.info('Connected.');

    // Fetch all employees sorted chronologically
    const employees = await Employee.find({}).sort({ joiningDate: 1, createdAt: 1 });
    logger.info(`Found ${employees.length} employees to migrate.`);

    // Group employees by joining year
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yearGroups: Record<number, any[]> = {};
    for (const emp of employees) {
        const d = new Date(emp.joiningDate);
        const year = isNaN(d.getTime()) ? emp.createdAt.getFullYear() : d.getFullYear();
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push(emp);
    }

    let updatedCount = 0;

    for (const yearStr of Object.keys(yearGroups)) {
        const year = parseInt(yearStr, 10);
        const emps = yearGroups[year];
        logger.info(`Processing year ${year}: ${emps.length} employees`);

        // Check which have valid IDs vs invalid IDs
        const pattern = new RegExp(`^EID${year}\\d{4}$`);
        let maxIndexUsed = -1; // mathematically how many IDs have been claimed?

        const invalidEmps = [];

        for (const emp of emps) {
            if (pattern.test(emp.employeeId)) {
                // It's already in the perfect format, let's preserve it and update our max tracker!
                const groupStr = emp.employeeId.substring(7, 9);
                const countStr = emp.employeeId.substring(9, 11);
                const group = parseInt(groupStr, 10);
                const count = parseInt(countStr, 10);
                
                if (!isNaN(group) && !isNaN(count)) {
                    const abstractIndex = ((group - 4) * 99) + (count - 1);
                    if (abstractIndex > maxIndexUsed) {
                        maxIndexUsed = abstractIndex;
                    }
                }
            } else {
                // ID needs migration
                invalidEmps.push(emp);
            }
        }

        // Now mathematically generate and apply IDs for all the invalid ones dynamically
        for (const emp of invalidEmps) {
            maxIndexUsed++; // Calculate next sequentially mathematically correct index
            const newId = await generateOfflineId(year, maxIndexUsed);
            
            logger.info(`Migrating Employee [${emp.userId}] from ${emp.employeeId} -> ${newId}`);
            emp.employeeId = newId;
            await emp.save({ validateBeforeSave: false }); // Skip other model validations
            updatedCount++;
        }
    }

    logger.info(`\nMigration completed successfully. Updated ${updatedCount} records.`);
    process.exit(0);
}

migrate().catch(err => {
    logger.error({ context: err }, 'Migration failed:');
    process.exit(1);
});
