/**
 * googleMeetSync.job.ts
 *
 * Background reconciliation job that syncs Google Meet conferences to CUOS.
 *
 * Architecture:
 * - Runs every 15 minutes via node-cron (same pattern as attendanceReminder.job.ts)
 * - Processes each connected user independently — one failure never blocks others
 * - Upserts meetings and attendance records atomically to prevent duplicates
 * - Recalculates daily work summaries only for affected users and dates
 *
 * ONE CONFERENCE = ONE CUOS MEETING (hard rule, enforced by googleConferenceId unique index)
 * ONE MEETING + MANY ATTENDANCE RECORDS per employee
 */

import cron from 'node-cron';
import { logger } from '../../../utils/logger';
import { GoogleIntegration, IGoogleIntegration } from '../models/GoogleIntegration.model';
import { MeetingAttendance } from '../models/MeetingAttendance.model';
import { Meeting } from '../../project/models/Meeting.model';
import { TimeLog } from '../../project/models/TimeLog.model';
import { User } from '../../auth/models/User.model';
import { getValidAccessToken } from '../services/google.oauth.service';
import { fetchCalendarEventsWithMeet } from '../services/google.calendar.service';
import { fetchMeetConferenceData, fetchRecentConferenceIds } from '../services/google.meet.service';
import { calculateUniqueMinutes, type Interval } from '../../../utils/intervalUtils';
import type { Types } from 'mongoose';

// ─── Main export ─────────────────────────────────────────────────────────────

export const initGoogleMeetSyncJob = () => {
    // Every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        logger.info('[CRON:GoogleMeet] Starting sync cycle');
        await runSyncCycle();
    });

    logger.info('[CRON:GoogleMeet] Google Meet sync job scheduled (every 15 minutes)');
};

// ─── Sync cycle ───────────────────────────────────────────────────────────────

async function runSyncCycle(): Promise<void> {
    const integrations = await GoogleIntegration.find({ status: 'active' })
        .select('+accessToken +refreshToken')
        .lean<(IGoogleIntegration & { accessToken: string; refreshToken: string })[]>();

    if (integrations.length === 0) {
        logger.info('[CRON:GoogleMeet] No active integrations to sync');
        return;
    }

    logger.info(`[CRON:GoogleMeet] Syncing ${integrations.length} integration(s)`);

    for (const integration of integrations) {
        try {
            await syncUserMeetings(integration);
        } catch (err) {
            // One user's failure must NOT stop others
            logger.error(
                { err, userId: integration.userId.toString() },
                '[CRON:GoogleMeet] Sync failed for user — continuing with next'
            );
        }
    }

    logger.info('[CRON:GoogleMeet] Sync cycle complete');
}

// ─── Per-user sync ────────────────────────────────────────────────────────────

export async function syncUserMeetings(
    integration: IGoogleIntegration & { accessToken: string; refreshToken: string; googleUserId?: string; googleEmail?: string }
): Promise<void> {
    const userId = integration.userId.toString();
    logger.debug({ userId }, '[GoogleMeet] Syncing user');

    // 1. Get a valid access token (refreshes automatically if needed)
    let accessToken: string;
    try {
        accessToken = await getValidAccessToken(integration);
    } catch {
        logger.warn({ userId }, '[GoogleMeet] Token refresh failed — skipping user');
        return; // status already marked requires_reauth by getValidAccessToken
    }

    // 2. Define time window: past 48h to 30 days in the future
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60_000);
    const timeMin = new Date(Date.now() - 48 * 60 * 60_000);

    // 3. Fetch Calendar events with Meet data
    const calendarEvents = await fetchCalendarEventsWithMeet(accessToken, timeMin, timeMax);

    // 4. Fetch recent conference records directly (catches instant meetings)
    const recentConferenceIds = await fetchRecentConferenceIds(accessToken, timeMin);

    // 5. Build list of unique conference IDs to process
    const conferenceIdSet = new Set<string>();
    for (const ev of calendarEvents) {
        if (ev.meetConferenceId) conferenceIdSet.add(ev.meetConferenceId);
    }
    for (const cid of recentConferenceIds) {
        conferenceIdSet.add(cid);
    }

    // 6. Process each conference
    const affectedDates = new Set<string>(); // for daily work recalculation

    for (const conferenceId of conferenceIdSet) {
        try {
            const dates = await processConference(
                conferenceId,
                userId,
                accessToken,
                integration,
                calendarEvents.find(ev => ev.meetConferenceId === conferenceId)
            );
            for (const d of dates) affectedDates.add(d);
        } catch (err) {
            logger.error({ err, conferenceId, userId }, '[GoogleMeet] Failed to process conference');
        }
    }

    // 7. Update lastSyncedAt
    await GoogleIntegration.updateOne(
        { _id: integration._id },
        { $set: { lastSyncedAt: new Date() } }
    );

    logger.debug({ userId, conferenceCount: conferenceIdSet.size }, '[GoogleMeet] User sync complete');
}

// ─── Conference processing ────────────────────────────────────────────────────

async function processConference(
    conferenceId: string,
    userId: string,
    accessToken: string,
    integration: IGoogleIntegration & { accessToken: string; refreshToken: string; googleUserId?: string; googleEmail?: string },
    calendarEvent?: { title: string; startTime: Date; endTime: Date; scheduledDurationMinutes: number; id: string; description?: string; attendees?: any[] } | undefined
): Promise<string[]> {

    // 1. Fetch actual Meet data from Meet v2 API
    // If we have calendar times, use them for timeMin/timeMax
    const timeMax = calendarEvent?.endTime ?? new Date();
    const timeMin = calendarEvent?.startTime ?? new Date(timeMax.getTime() - 48 * 60 * 60_000);

    const conferenceData = integration.googleUserId && integration.googleEmail ? await fetchMeetConferenceData(
        accessToken, 
        conferenceId,
        timeMin,
        timeMax,
        integration.googleUserId,
        integration.googleEmail
    ) : null;

    // If no conference data AND no calendar event → skip
    if (!conferenceData && !calendarEvent) return [];

    // 2. Determine meeting metadata
    const title = calendarEvent?.title ?? 'Google Meet — Ad hoc';
    const scheduledAt = calendarEvent?.startTime ?? conferenceData?.actualStartTime ?? new Date();
    const scheduledDuration = calendarEvent?.scheduledDurationMinutes ?? 0;
    const actualDuration = conferenceData?.actualStartTime && conferenceData?.actualEndTime
        ? Math.round(
              (conferenceData.actualEndTime.getTime() - conferenceData.actualStartTime.getTime()) / 60_000
          )
        : undefined;

    // 3. Skip if conference is still active (don't finalize prematurely)
    if (conferenceData?.isActive) {
        logger.debug({ conferenceId }, '[GoogleMeet] Conference still active — skipping finalization');
        return [];
    }

    // 4. Build participants list
    const participantEmails = new Set<string>();
    
    // Add calendar attendees
    if (calendarEvent?.attendees) {
        for (const attendee of calendarEvent.attendees) {
            if (attendee.email) participantEmails.add(attendee.email.toLowerCase());
        }
    }
    
    // Add actual conference participants
    if (conferenceData?.sessions) {
        for (const session of conferenceData.sessions) {
            if (session.email) participantEmails.add(session.email.toLowerCase());
        }
    }
    
    // Also make sure the syncing user is added
    if (integration.googleEmail) {
        participantEmails.add(integration.googleEmail.toLowerCase());
    }

    // Map emails to CUOS users
    const matchedUsers = await User.find({ email: { $in: Array.from(participantEmails) }, isActive: true }).select('_id email').lean();
    const matchedEmails = new Set(matchedUsers.map(u => u.email.toLowerCase()));
    
    const participantsList: any[] = matchedUsers.map(u => ({
        userId: u._id,
        role: 'required',
    }));
    
    for (const email of participantEmails) {
        if (!matchedEmails.has(email)) {
            participantsList.push({ externalEmail: email, role: 'required' });
        }
    }

    // 5. Upsert the Meeting document (atomic — prevents duplicate on concurrent sync)
    const meetingDoc = await Meeting.findOneAndUpdate(
        { googleConferenceId: conferenceId },
        {
            $setOnInsert: {
                title,
                type: 'internal',
                scheduledAt,
                duration: scheduledDuration || 1,
                source: 'google_meet',
                googleConferenceId: conferenceId,
                createdBy: userId, // The syncing user created it
                accessLevel: 'project-team',
            },
            $set: {
                googleCalendarEventId: calendarEvent?.id,
                actualStartTime: conferenceData?.actualStartTime,
                actualEndTime: conferenceData?.actualEndTime,
                actualDuration,
                conferenceStatus: conferenceData
                    ? conferenceData.isActive ? 'active' : 'ended'
                    : 'scheduled',
                participants: participantsList,
            },
        },
        {
            new: true,
            upsert: true,
            runValidators: false, // Skip validators on upsert to avoid required field errors
        }
    );

    if (!meetingDoc) return [];

    const meetingId = meetingDoc._id.toString();
    const affectedDates: string[] = [];

    // 5. Process participant sessions (if conference data available)
    if (conferenceData?.sessions && conferenceData.sessions.length > 0) {
        // Group sessions by participant identity
        const byParticipant = new Map<string, typeof conferenceData.sessions>();
        for (const session of conferenceData.sessions) {
            const key = session.participantId ?? session.email ?? 'unknown';
            if (!byParticipant.has(key)) byParticipant.set(key, []);
            byParticipant.get(key)!.push(session);
        }

        for (const [participantKey, sessions] of byParticipant) {
            const participantEmail = sessions[0].email;

            // 6. Map Google participant to CUOS User by email
            let cuosUserId: string | undefined;
            if (participantEmail) {
                const cuosUser = await User.findOne({
                    email: participantEmail.toLowerCase(),
                    isActive: true,
                }).select('_id').lean();
                cuosUserId = cuosUser?._id?.toString();
            }

            // 7. Build session intervals for this participant
            const intervals: Interval[] = sessions
                .filter(s => s.joinTime && s.leaveTime)
                .map(s => ({ start: new Date(s.joinTime), end: new Date(s.leaveTime!) }));

            // 8. Calculate unique attendance (handles multi-device overlaps)
            const actualAttendanceMinutes = calculateUniqueMinutes(intervals);

            // 9. Upsert MeetingAttendance
            const attendanceFilter = cuosUserId
                ? { meetingId: meetingDoc._id, userId: cuosUserId }
                : { meetingId: meetingDoc._id, googleParticipantId: participantKey };

            const sessionDocs = sessions.map(s => ({
                sessionId: s.sessionId,
                joinTime: s.joinTime,
                leaveTime: s.leaveTime,
                deviceType: s.deviceType,
            }));

            const attendance = await MeetingAttendance.findOneAndUpdate(
                attendanceFilter,
                {
                    $set: {
                        meetingId: meetingDoc._id,
                        ...(cuosUserId ? { userId: cuosUserId } : {}),
                        googleParticipantId: participantKey,
                        googleEmail: participantEmail,
                        displayName: sessions[0].displayName,
                        sessions: sessionDocs,
                        actualAttendanceMinutes,
                    },
                },
                { new: true, upsert: true, runValidators: false }
            );

            // 10. Upsert TimeLog for this employee (if mapped to CUOS user and attendance > 0)
            if (cuosUserId && actualAttendanceMinutes > 0 && intervals.length > 0) {
                const earliest = intervals.reduce((a, b) => a.start < b.start ? a : b);
                const latest   = intervals.reduce((a, b) => a.end > b.end ? a : b);
                const logDate  = new Date(earliest.start);
                logDate.setUTCHours(0, 0, 0, 0);

                // Upsert TimeLog — use meetingId + userId as idempotency key
                const existingLog = attendance?.timeLogId
                    ? await TimeLog.findById(attendance.timeLogId)
                    : await TimeLog.findOne({
                          userId: cuosUserId,
                          description: `Meeting: ${title}`,
                          date: { $gte: logDate, $lt: new Date(logDate.getTime() + 86_400_000) },
                          startTime: earliest.start,
                      });

                if (existingLog) {
                    // Update existing TimeLog
                    existingLog.duration  = actualAttendanceMinutes;
                    existingLog.startTime = earliest.start;
                    existingLog.endTime   = latest.end;
                    await existingLog.save();
                } else {
                    // Create new TimeLog
                    const newLog = await TimeLog.create({
                        userId: cuosUserId,
                        taskId: meetingDoc._id, // Reference the meeting document as the "task"
                        date: logDate,
                        duration: actualAttendanceMinutes,
                        startTime: earliest.start,
                        endTime: latest.end,
                        description: `Meeting: ${title}`,
                        billable: false,
                        source: 'google_meet',
                    } as any);

                    // Link TimeLog back to attendance record
                    await MeetingAttendance.updateOne(
                        { _id: attendance._id },
                        { $set: { timeLogId: newLog._id } }
                    );
                }

                // Track affected date for daily work recalculation
                const dateStr = logDate.toISOString().split('T')[0];
                affectedDates.push(`${cuosUserId}:${dateStr}`);
            }

            // Update Meeting participants array
            await Meeting.updateOne(
                { _id: meetingDoc._id, 'participants.userId': { $ne: cuosUserId } },
                {
                    $addToSet: {
                        participants: cuosUserId
                            ? { userId: cuosUserId, role: 'required' }
                            : { externalEmail: participantEmail, name: sessions[0].displayName, role: 'required' },
                    },
                }
            );
        }
    } else if (!conferenceData && calendarEvent) {
        // Fallback: Calendar event only — no conference data available (e.g., external meeting)
        // We log the scheduled time since we can't access the actual Meet records.
        logger.debug({ conferenceId }, '[GoogleMeet] No conference data — falling back to scheduled time');

        if (calendarEvent.scheduledDurationMinutes > 0) {
            const logDate = new Date(calendarEvent.startTime);
            logDate.setUTCHours(0, 0, 0, 0);

            const existingLog = await TimeLog.findOne({
                userId: userId,
                description: `Meeting: ${title}`,
                date: { $gte: logDate, $lt: new Date(logDate.getTime() + 86_400_000) },
                startTime: calendarEvent.startTime,
            });

            if (existingLog) {
                // Update existing TimeLog
                existingLog.duration = calendarEvent.scheduledDurationMinutes;
                existingLog.endTime = calendarEvent.endTime;
                await existingLog.save();
            } else {
                // Create new TimeLog
                await TimeLog.create({
                    userId: userId,
                    taskId: meetingDoc._id,
                    date: logDate,
                    duration: calendarEvent.scheduledDurationMinutes,
                    startTime: calendarEvent.startTime,
                    endTime: calendarEvent.endTime,
                    description: `Meeting: ${title}`,
                    billable: false,
                    source: 'google_meet',
                } as any);
            }

            const dateStr = logDate.toISOString().split('T')[0];
            affectedDates.push(`${userId}:${dateStr}`);
        }
    }

    // Return unique date strings for recalculation
    return [...new Set(affectedDates.map(d => d.split(':')[1]))];
}
