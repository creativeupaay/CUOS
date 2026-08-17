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

        // Fetch calendar list
        const calendarListResponse = await calendar.calendarList.list();
        const calendars = calendarListResponse.data.items ?? [];
        
        // Fetch events from all calendars in parallel
        const calendarPromises = calendars.map(async (cal) => {
            try {
                const response = await calendar.events.list({
                    calendarId: cal.id!,
                    timeMin: timeMin.toISOString(),
                    timeMax: timeMax.toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime',
                    maxResults: 100,
                    conferenceDataVersion: 1, // REQUIRED to get Meet links!
                } as any);

                const items = response.data.items ?? [];
                const calResults: CalendarEvent[] = [];

                for (const event of items) {
                    const conf = event.conferenceData;
                    const videoEntry = conf?.entryPoints?.find((ep: any) => ep.entryPointType === 'video');

                    const startRaw = event.start?.dateTime;
                    const endRaw   = event.end?.dateTime;
                    if (!startRaw || !endRaw) continue; // Ignore all-day events like public holidays

                    const startTime = new Date(startRaw);
                    const endTime   = new Date(endRaw);
                    const scheduledDurationMinutes = Math.round(
                        (endTime.getTime() - startTime.getTime()) / 60_000
                    );

                    calResults.push({
                        id: event.id!,
                        title: event.summary?.trim() || 'Google Meet',
                        startTime,
                        endTime,
                        scheduledDurationMinutes,
                        conferenceData: conf ? {
                            conferenceId:       conf.conferenceId ?? undefined,
                            conferenceSolution: conf.conferenceSolution?.name ?? undefined,
                            entryPoints:        (conf.entryPoints ?? []).map((ep: any) => ({
                                entryPointType: ep.entryPointType ?? '',
                                uri:   ep.uri   ?? undefined,
                                label: ep.label ?? undefined,
                            })),
                        } : undefined,
                        meetConferenceId: conf?.conferenceId ?? undefined,
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
                return calResults;
            } catch (err: any) {
                // Ignore errors for individual calendars (e.g. no permission)
                logger.warn({ err: err.message, calendarId: cal.id }, '[Google Calendar] Error fetching events for calendar');
                return [];
            }
        });

        const nestedResults = await Promise.all(calendarPromises);
        const results = nestedResults.flat();

        // sort results by start time
        results.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        return results;
    } catch (err: any) {
        logger.error({ err }, '[Google Calendar] Failed to fetch events');
        throw err;
    }
}
