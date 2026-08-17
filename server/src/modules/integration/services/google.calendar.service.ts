/**
 * google.calendar.service.ts
 *
 * Fetches Google Calendar events for a user.
 * Returns structured meeting metadata (title, times, conference info).
 * Does NOT return actual participant attendance — that comes from the Reports API.
 */

import { google } from 'googleapis';
import { getOAuth2Client } from './google.oauth.service';
import { logger } from '../../../utils/logger';

export interface CalendarEventConferenceData {
    conferenceId?: string;
    conferenceSolution?: string; // 'hangoutsMeet', etc.
    entryPoints?: Array<{
        entryPointType: string; // 'video', 'phone', etc.
        uri?: string;
        label?: string;
    }>;
}

export interface CalendarEvent {
    id: string;                     // Google Calendar event ID
    title: string;
    startTime: Date;
    endTime: Date;
    scheduledDurationMinutes: number;
    conferenceData?: CalendarEventConferenceData;
    /** The Google Meet conference ID extracted from conference data */
    meetConferenceId?: string;
    /** Direct Google Meet join URL */
    meetLink?: string;
    description?: string;
    organizer?: string;
    attendees?: Array<{
        email: string;
        displayName?: string;
        responseStatus?: string;
    }>;
}

/**
 * Fetch Calendar events for a user within a time window.
 * Only returns events that have Google Meet conference data attached.
 *
 * @param accessToken - valid decrypted access token
 * @param timeMin - start of window (ISO string or Date)
 * @param timeMax - end of window (ISO string or Date)
 */
export async function fetchCalendarEventsWithMeet(
    accessToken: string,
    timeMin: Date,
    timeMax: Date
): Promise<CalendarEvent[]> {
    try {
        const auth = getOAuth2Client();
        auth.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth });

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,     // expand recurring events into individual occurrences
            orderBy: 'startTime',
            maxResults: 100,
            fields: 'items(id,summary,start,end,conferenceData,description,organizer,attendees)',
        });

        const items = response.data.items ?? [];

        const results: CalendarEvent[] = [];

        for (const event of items) {
            // Only process events with Google Meet conference data
            const conf = event.conferenceData;
            if (!conf) continue;

            const videoEntry = conf.entryPoints?.find(ep => ep.entryPointType === 'video');
            if (!conf.conferenceId && !videoEntry?.uri) continue;

            const startRaw = event.start?.dateTime ?? event.start?.date;
            const endRaw   = event.end?.dateTime   ?? event.end?.date;
            if (!startRaw || !endRaw) continue;

            const startTime = new Date(startRaw);
            const endTime   = new Date(endRaw);
            const scheduledDurationMinutes = Math.round(
                (endTime.getTime() - startTime.getTime()) / 60_000
            );

            results.push({
                id: event.id!,
                title: event.summary?.trim() || 'Google Meet',
                startTime,
                endTime,
                scheduledDurationMinutes,
                conferenceData: {
                    conferenceId:       conf.conferenceId ?? undefined,
                    conferenceSolution: conf.conferenceSolution?.name ?? undefined,
                    entryPoints:        (conf.entryPoints ?? []).map(ep => ({
                        entryPointType: ep.entryPointType ?? '',
                        uri:   ep.uri   ?? undefined,
                        label: ep.label ?? undefined,
                    })),
                },
                meetConferenceId: conf.conferenceId ?? undefined,
                meetLink: videoEntry?.uri ?? undefined,
                description: event.description ?? undefined,
                organizer: event.organizer?.email ?? undefined,
                attendees: event.attendees?.map((a: any) => ({
                    email: a.email,
                    displayName: a.displayName,
                    responseStatus: a.responseStatus,
                })).filter((a: any) => !!a.email),
            });
        }

        return results;
    } catch (err: any) {
        // 403 = insufficient permissions / not a Workspace account
        if (err?.code === 403 || err?.status === 403) {
            logger.warn('[Google Calendar] Insufficient permissions to read calendar events');
            return [];
        }
        logger.error({ err }, '[Google Calendar] Failed to fetch events');
        throw err;
    }
}
