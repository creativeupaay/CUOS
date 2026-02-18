/**
 * One-time migration script to update existing leads
 * from old stages (won, lost) to new stages (closed, lead-lost).
 *
 * Run with: npx ts-node src/scripts/migrateCrmStages.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cuos';

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
        console.error('Database connection not established');
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
    console.log(`Updated ${wonResult.modifiedCount} leads from 'won' to 'closed'`);

    // Migrate 'lost' → 'lead-lost'
    const lostResult = await leadsCollection.updateMany(
        { stage: 'lost' },
        { $set: { stage: 'lead-lost' } }
    );
    console.log(`Updated ${lostResult.modifiedCount} leads from 'lost' to 'lead-lost'`);

    // Add isLocked:false to all leads that don't have it
    const lockedResult = await leadsCollection.updateMany(
        { isLocked: { $exists: false } },
        { $set: { isLocked: false } }
    );
    console.log(`Set isLocked=false on ${lockedResult.modifiedCount} leads`);

    // Add meetings:[] to all leads that don't have it
    const meetingsResult = await leadsCollection.updateMany(
        { meetings: { $exists: false } },
        { $set: { meetings: [] } }
    );
    console.log(`Set empty meetings on ${meetingsResult.modifiedCount} leads`);

    await mongoose.disconnect();
    console.log('Migration complete!');
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
