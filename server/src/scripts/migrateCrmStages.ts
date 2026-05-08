/**
 * One-time migration script to update existing leads
 * from old stages (won, lost) to new stages (closed, lead-lost).
 *
 * Run with: npx ts-node src/scripts/migrateCrmStages.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { logger } from "../utils/logger";

dotenv.config();

async function migrate() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cuos';

    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
        logger.error('Database connection not established');
        process.exit(1);
    }

    const leadsCollection = db.collection('leads');

    // Migrate 'won' → 'closed'
    const wonResult = await leadsCollection.updateMany(
        { stage: 'won' },
        {
            $set: {
                stage: 'closed',
                isLocked: true,
                closedAt: new Date(),
            },
        }
    );
    logger.info(`Updated ${wonResult.modifiedCount} leads from 'won' to 'closed'`);

    // Migrate 'lost' → 'lead-lost'
    const lostResult = await leadsCollection.updateMany(
        { stage: 'lost' },
        { $set: { stage: 'lead-lost' } }
    );
    logger.info(`Updated ${lostResult.modifiedCount} leads from 'lost' to 'lead-lost'`);

    // Add isLocked:false to all leads that don't have it
    const lockedResult = await leadsCollection.updateMany(
        { isLocked: { $exists: false } },
        { $set: { isLocked: false } }
    );
    logger.info(`Set isLocked=false on ${lockedResult.modifiedCount} leads`);

    // Add meetings:[] to all leads that don't have it
    const meetingsResult = await leadsCollection.updateMany(
        { meetings: { $exists: false } },
        { $set: { meetings: [] } }
    );
    logger.info(`Set empty meetings on ${meetingsResult.modifiedCount} leads`);

    await mongoose.disconnect();
    logger.info('Migration complete!');
}

migrate().catch((err) => {
    logger.error({ context: err }, 'Migration failed:');
    process.exit(1);
});
