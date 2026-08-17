import mongoose from 'mongoose';
import { env } from './src/config/env.config';
import { GoogleIntegration } from './src/modules/integration/models/GoogleIntegration.model';
import { getValidAccessToken } from './src/modules/integration/services/google.oauth.service';
import { fetchCalendarEventsWithMeet } from './src/modules/integration/services/google.calendar.service';
import { fetchRecentConferenceIds } from './src/modules/integration/services/google.meet.service';

const run = async () => {
    try {
        await mongoose.connect(env.MONGO_URI);
        console.log('Connected to DB');

        const integrations = await GoogleIntegration.find({ status: 'active' }).select('+accessToken +refreshToken').lean<any[]>();
        if (integrations.length === 0) {
            console.log('No active integrations found');
            process.exit(0);
        }

        const integration = integrations[0];
        console.log(`Testing for user: ${integration.userId}`);

        const token = await getValidAccessToken(integration);
        console.log('Got valid token');

        const timeMin = new Date();
        const timeMax = new Date(timeMin.getTime() + 7 * 24 * 60 * 60 * 1000);

        const events = await fetchCalendarEventsWithMeet(token, timeMin, timeMax);
        console.log(`Found ${events.length} upcoming events`);
        console.log(events.map(e => ({ title: e.title, start: e.startTime })));

        const pastMin = new Date(Date.now() - 48 * 60 * 60_000);
        const recentEvents = await fetchCalendarEventsWithMeet(token, pastMin, timeMax);
        console.log(`Found ${recentEvents.length} total events in past 48h`);

        const recentIds = await fetchRecentConferenceIds(token, pastMin);
        console.log(`Found ${recentIds.length} recent conference IDs via Admin API`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
