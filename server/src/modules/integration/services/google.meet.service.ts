/**
 * google.meet.service.ts
 *
 * Fetches actual Google Meet conference participant data using the Google
 * Meet REST API v2.
 *
 * This implementation uses individual OAuth (NOT Admin Reports API).
 * A user can only fetch conference records for meetings they organized
 * (or have explicit access to). For external meetings, the API returns 403 Forbidden.
 */

import { google } from 'googleapis';
import { getOAuth2Client } from './google.oauth.service';
import { env } from '../../../config/env.config';
import { logger } from '../../../utils/logger';

export interface MeetParticipantSession {
    sessionId?: string;
    participantId?: string;
    email?: string;
    displayName?: string;
    joinTime: Date;
    leaveTime?: Date;
    deviceType?: string;
    durationSeconds?: number;
}

export interface MeetConferenceRecord {
    conferenceId: string;
    actualStartTime?: Date;
    actualEndTime?: Date;
    sessions: MeetParticipantSession[];
    isActive: boolean;
}

/**
 * Fetch Google Meet conference participant data using the Meet v2 API.
 *
 * @param accessToken - valid decrypted access token
 * @param meetingCode - The 10-letter meeting code (e.g. abc-defg-hij)
 * @param timeMin - Lower bound of meeting time
 * @param timeMax - Upper bound of meeting time
 * @param googleUserId - The google user ID of the authenticated user to help matching
 * @param googleEmail - The google email of the authenticated user to help matching
 * @returns participant sessions or null if not available
 */
export async function fetchMeetConferenceData(
    accessToken: string,
    meetingCode: string,
    timeMin: Date,
    timeMax: Date,
    googleUserId: string,
    googleEmail: string
): Promise<MeetConferenceRecord | null> {
    try {
        const auth = getOAuth2Client();
        auth.setCredentials({ access_token: accessToken });

        const meet = google.meet({ version: 'v2', auth });

        // List conference records for this meeting code
        const response = await meet.conferenceRecords.list({
            filter: `space.meeting_code="${meetingCode}"`,
            pageSize: 10,
        });

        const records = response.data.conferenceRecords ?? [];
        if (records.length === 0) return null;

        // Find a record that falls within our expected time bounds
        const record = records.find((r: any) => {
            if (!r.startTime) return false;
            const start = new Date(r.startTime);
            // Allow 2 hours leeway for early/late starts
            return start >= new Date(timeMin.getTime() - 7200_000) && 
                   start <= new Date(timeMax.getTime() + 7200_000);
        }) || records[0];

        const conferenceRecordId = record.name;
        if (!conferenceRecordId) return null;

        const sessions: MeetParticipantSession[] = [];
        const actualStartTime = record.startTime ? new Date(record.startTime) : undefined;
        const actualEndTime = record.endTime ? new Date(record.endTime) : undefined;
        const isActive = !record.endTime;

        // Fetch participants for this conference record
        const participantsRes = await meet.conferenceRecords.participants.list({
            parent: conferenceRecordId,
            pageSize: 100,
        });

        const participants = participantsRes.data.participants ?? [];

        const participantPromises = participants.map(async (p: any) => {
            if (!p.name) return [];

            const isCurrentUser = p.signedinUser?.user === `users/${googleUserId}`;
            const participantId = p.signedinUser?.user || p.anonymousUser?.displayName || 'unknown';

            try {
                // Fetch sessions for this participant
                const sessionsRes = await meet.conferenceRecords.participants.participantSessions.list({
                    parent: p.name,
                    pageSize: 100,
                });

                const pSessions = sessionsRes.data.participantSessions ?? [];
                return pSessions.map((s: any) => ({
                    sessionId: s.name || undefined,
                    participantId: participantId,
                    email: isCurrentUser ? googleEmail : (participantId || undefined), // Use the authenticated user's email if matched
                    joinTime: s.startTime ? new Date(s.startTime) : (actualStartTime || new Date()),
                    leaveTime: s.endTime ? new Date(s.endTime) : undefined,
                }));
            } catch (err) {
                return [];
            }
        });

        const nestedSessions = await Promise.all(participantPromises);
        sessions.push(...nestedSessions.flat());

        return {
            conferenceId: record.name || '',
            actualStartTime,
            actualEndTime,
            sessions,
            isActive,
        };

    } catch (err: any) {
        if (err?.code === 403 || err?.status === 403) {
            logger.debug({ meetingCode }, '[Google Meet] Non-organizer: cannot access Meet v2 API');
            return null; // Graceful fallback
        }
        logger.error({ err, meetingCode }, '[Google Meet] Failed to fetch Meet v2 conference data');
        return null;
    }
}

/**
 * Fetch all Meet conferences organized by the user within a time window.
 * This is crucial for discovering "instant meetings" that don't have a calendar event.
 * Returns a list of conference record names (IDs).
 */
export async function fetchRecentConferenceIds(
    accessToken: string,
    timeMin: Date
): Promise<string[]> {
    try {
        const auth = getOAuth2Client();
        auth.setCredentials({ access_token: accessToken });

        const meet = google.meet({ version: 'v2', auth });

        // Filter for conferences organized by the user starting after timeMin
        const filter = `start_time>="${timeMin.toISOString()}"`;

        const response = await meet.conferenceRecords.list({
            filter,
            pageSize: 100,
        });

        const records = response.data.conferenceRecords ?? [];
        const meetingCodes = new Set<string>();

        // Fetch the space for each record in parallel
        const spacePromises = records.map(async (r: any) => {
            if (!r.space) return null;
            try {
                const spaceRes = await meet.spaces.get({ name: r.space });
                return spaceRes.data.meetingCode;
            } catch (err) {
                return null;
            }
        });

        const codes = await Promise.all(spacePromises);
        codes.forEach(code => {
            if (code) meetingCodes.add(code);
        });

        return Array.from(meetingCodes);
    } catch (err: any) {
        if (err?.code === 403 || err?.status === 403) return [];
        logger.error({ err }, '[Google Meet] Failed to fetch recent conference IDs from Meet API');
        return [];
    }
}
