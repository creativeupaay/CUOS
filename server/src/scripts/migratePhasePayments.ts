import mongoose from 'mongoose';
import dotenv from 'dotenv';


// Load environment variables
dotenv.config();

import { Project } from '../modules/project/models/Project.model';
import { Revenue } from '../modules/finance/models/Revenue.model';

async function migratePhasePayments() {
    try {
        console.log('Connecting to database...');
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cuos';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const isStandalone = true; // Set to false when running on Staging/Production with Replica Set
        let session = null;

        if (!isStandalone) {
            session = await mongoose.startSession();
            session.startTransaction();
        }
        
        try {
            console.log('Fetching projects with phases...');
            const projects = await Project.find({ 'phases.0': { $exists: true } });
            
            let migratedCount = 0;
            let projectsUpdated = 0;

            for (const project of projects) {
                let projectModified = false;

                for (const phase of project.phases) {
                    // Only process phases that have received payments but missing paymentReceivedAmountINR
                    if (
                        (phase.paymentStatus === 'received' || phase.paymentStatus === 'partial') && 
                        (!phase.paymentReceivedAmountINR || phase.paymentReceivedAmountINR === 0)
                    ) {
                        // Find all revenue entries for this phase
                        const revenues = await Revenue.find({
                            projectId: project._id,
                            phaseId: phase._id,
                            source: 'project',
                            status: 'received'
                        });

                        let totalReceivedINR = 0;
                        if (revenues.length > 0) {
                            // Sum up the received amounts from revenues
                            totalReceivedINR = revenues.reduce((sum, rev) => sum + (rev.amountINR || 0), 0);
                        } else if (phase.paymentStatus === 'received' && phase.paymentExpectedAmountINR) {
                            // Fallback for older records without revenues or if expected amount is available
                            totalReceivedINR = phase.paymentExpectedAmountINR;
                        }

                        if (totalReceivedINR > 0) {
                            phase.paymentReceivedAmountINR = totalReceivedINR;
                            projectModified = true;
                            migratedCount++;
                            console.log(`Migrated Project ${project.name} | Phase ${phase.name} -> Received: ₹${totalReceivedINR}`);
                        }
                    }
                }

                if (projectModified) {
                    await project.save({ validateModifiedOnly: true });
                    projectsUpdated++;
                }
            }

            if (!isStandalone && session) {
                await session.commitTransaction();
            }
            console.log(`\nMigration completed successfully.`);
            console.log(`Total projects updated: ${projectsUpdated}`);
            console.log(`Total phases migrated: ${migratedCount}`);

        } catch (error) {
            console.error('Error during migration, rolling back...', error);
            if (!isStandalone && session) {
                await session.abortTransaction();
            }
            throw error;
        } finally {
            if (!isStandalone && session) {
                session.endSession();
            }
        }

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migratePhasePayments();
