import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Client } from '../modules/client/models/Client.model';
import { Lead } from '../modules/crm/models/Lead.model';
import { logger } from "../utils/logger";

dotenv.config();

async function migrate() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/cuos';

    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    const clients = await Client.find({ leadId: { $exists: true, $ne: null } });
    logger.info(`Found ${clients.length} clients with leadId`);

    let updatedCount = 0;

    for (const client of clients) {
        const lead = await Lead.findById(client.leadId);

        if (lead && lead.activities && lead.activities.length > 0) {
            // Check if client already has activities
            if (!client.activities || client.activities.length === 0) {
                client.activities = lead.activities.map((act) => ({
                    type: act.type,
                    description: act.description,
                    date: act.date,
                    createdBy: act.createdBy,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                })) as any;

                await client.save();
                updatedCount++;
                logger.info(`Updated client ${client.name} with ${lead.activities.length} activities`);
            } else {
                // If the user wants to merge all of them, let's just do a simple check.
                // Assuming we might have added some, but to be safe: 
                // if client has activities, we merge them and remove duplicates by _id (if any, though they'll get new _ids).
                // Actually, since this is a new feature, existing clients probably have 0 activities. 
                // We'll just overwrite/assign if client has 0 activities. 
                // If they have activities, we can append the lead activities that are older, or just rely on the fact that existing clients didn't have this feature until today.
                // Re-running this should be safe if we just skip those that already have it.
                // For safety, checking if it's 0 is fine.
                logger.info(`Client ${client.name} already has activities`);

                // Let's actually merge them to be safe if client newly logged activities today but we still want the old ones.
                const existingDescDates = new Set(client.activities.map(a => `${a.type}-${a.date.getTime()}`));
                let added = false;
                for (const act of lead.activities) {
                    if (!existingDescDates.has(`${act.type}-${act.date.getTime()}`)) {
                        client.activities.push({
                            type: act.type,
                            description: act.description,
                            date: act.date,
                            createdBy: act.createdBy,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        } as any);
                        added = true;
                    }
                }
                if (added) {
                    // Sort by date inside to keep them chronologically
                    client.activities.sort((a, b) => a.date.getTime() - b.date.getTime());
                    await client.save();
                    updatedCount++;
                    logger.info(`Merged new activities for client ${client.name}`);
                }
            }
        }
    }

    logger.info(`Migration complete! Updated ${updatedCount} clients.`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    logger.error({ context: err }, 'Migration failed:');
    process.exit(1);
});
