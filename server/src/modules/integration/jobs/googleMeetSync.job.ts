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

    // 5. Process each calendar event
    const affectedDates = new Set<string>(); // for daily work recalculation

    // Process calendar events in parallel
    const calendarPromises = calendarEvents.map(async (ev) => {
        try {
            // Use the calendar's conference ID as the stable deduplication key.
            // The meetLink URL contains the actual meeting code for the Meet v2 API.
            const cid = ev.meetConferenceId || `cal_${ev.id}`;
            const dates = await processConference(
                cid,
                userId,
                accessToken,
                integration,
                ev
            );
            return dates;
        } catch (err) {
            logger.error({ err, eventId: ev.id, userId }, '[GoogleMeet] Failed to process calendar event');
            return [];
        }
    });

    // Process ad-hoc recent conferences in parallel
    const recentPromises = recentConferenceIds
        .filter(cid => !calendarEvents.some(ev => ev.meetConferenceId === cid))
        .map(async (cid) => {
            try {
                const dates = await processConference(
                    cid,
                    userId,
                    accessToken,
                    integration,
                    undefined
                );
                return dates;
            } catch (err) {
                logger.error({ err, conferenceId: cid, userId }, '[GoogleMeet] Failed to process recent conference');
                return [];
            }
        });

    const results = await Promise.all([...calendarPromises, ...recentPromises]);
    for (const dates of results) {
        for (const d of dates) affectedDates.add(d);
    }

    // 7. Update lastSyncedAt
    await GoogleIntegration.updateOne(
        { _id: integration._id },
        { $set: { lastSyncedAt: new Date() } }
    );

    logger.debug({ userId, calendarEventsCount: calendarEvents.length, recentConferenceCount: recentConferenceIds.length }, '[GoogleMeet] User sync complete');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the 10-letter meeting code from a Google Meet URL.
 * e.g. "https://meet.google.com/abc-defg-hij" → "abc-defg-hij"
 * Returns null if the URL is not a valid Meet URL.
 */
function extractMeetingCode(meetUrl?: string): string | null {
    if (!meetUrl) return null;
    try {
        const url = new URL(meetUrl);
        // Path is like /abc-defg-hij or /lookup/abc-defg-hij
        const parts = url.pathname.split('/').filter(Boolean);
        // The meeting code segment matches the pattern: xxx-xxxx-xxx
        const codeSegment = parts.find(p => /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(p));
        return codeSegment?.toLowerCase() || null;
    } catch {
        return null;
    }
}

// ─── Conference processing ────────────────────────────────────────────────────

async function processConference(
    conferenceId: string,
    userId: string,
    accessToken: string,
    integration: IGoogleIntegration & { accessToken: string; refreshToken: string; googleUserId?: string; googleEmail?: string },
    calendarEvent?: { title: string; startTime: Date; endTime: Date; scheduledDurationMinutes: number; id: string; description?: string; attendees?: any[]; meetLink?: string } | undefined
): Promise<string[]> {

    // 1. Fetch actual Meet data from Meet v2 API
    // If we have calendar times, use them for timeMin/timeMax
    const timeMax = calendarEvent?.endTime ?? new Date();
    const timeMin = calendarEvent?.startTime ?? new Date(timeMax.getTime() - 48 * 60 * 60_000);

    // ── FIX 1: Extract the 10-letter meeting code from the Meet link URL.
    // The Meet v2 API filter `space.meeting_code` expects the short code (e.g. "abc-defg-hij"),
    // NOT the Google Calendar conference ID (which is a different, longer identifier).
    // Without this, fetchMeetConferenceData always returns null → actualDuration stays null → UI shows "Pending".
    const meetingCode = extractMeetingCode(calendarEvent?.meetLink);

    const conferenceData = integration.googleUserId && integration.googleEmail && meetingCode
        ? await fetchMeetConferenceData(
            accessToken,
            meetingCode,      // ← correct: short meeting code, not conference ID
            timeMin,
            timeMax,
            integration.googleUserId,
            integration.googleEmail
        )
        : null;

    // If no conference data AND no calendar event → skip
    if (!conferenceData && !calendarEvent) return [];

    // 2. Determine meeting metadata
    let title = calendarEvent?.title;
    if (!title || title.trim() === 'Google Meet') {
        title = 'Google Meet — Ad hoc';
    }

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
        // Even if active, update status on any existing meeting so UI shows "Ongoing"
        await Meeting.updateMany(
            {
                $or: [
                    { googleConferenceId: conferenceId },
                    { googleCalendarEventId: calendarEvent?.id },
                ],
            },
            { $set: { conferenceStatus: 'active' } }
        );
        return [];
    }

    // 4. Build participants list and calculate durations
    const participantEmails = new Set<string>();
    const participantDurations = new Map<string, number>();

    // Compute durations from actual conference sessions
    if (conferenceData?.sessions) {
        // --- Identity Resolution ---
        for (const session of conferenceData.sessions) {
            if (session.email) continue;
            
            let resolvedEmail: string | undefined;
            // Step 1: Match by Google integration (users/123 -> 123)
            if (session.participantId && session.participantId.startsWith('users/')) {
                const googleId = session.participantId.replace('users/', '');
                const integrationMatch = await GoogleIntegration.findOne({ googleUserId: googleId }).select('googleEmail').lean() as any;
                if (integrationMatch?.googleEmail) {
                    resolvedEmail = integrationMatch.googleEmail;
                }
            }
            // Step 2: Fuzzy match displayName against calendar attendees
            if (!resolvedEmail && session.displayName && calendarEvent?.attendees) {
                const match = calendarEvent.attendees.find(a => 
                    a.displayName?.toLowerCase() === session.displayName!.toLowerCase()
                );
                if (match?.email) resolvedEmail = match.email;
            }
            // Step 3: Fuzzy match displayName against CUOS users
            if (!resolvedEmail && session.displayName) {
                const cuosUsers = await User.find({ name: new RegExp(`^${session.displayName}$`, 'i'), isActive: true }).select('email').lean();
                if (cuosUsers.length === 1) { // Only use if unambiguous
                    resolvedEmail = cuosUsers[0].email;
                }
            }
            if (resolvedEmail) {
                session.email = resolvedEmail;
            }
        }
        // ---------------------------

        const byEmail = new Map<string, typeof conferenceData.sessions>();
        for (const session of conferenceData.sessions) {
            if (session.email) {
                const email = session.email.toLowerCase();
                if (!byEmail.has(email)) byEmail.set(email, []);
                byEmail.get(email)!.push(session);
                participantEmails.add(email);
            }
        }
        for (const [email, sessions] of byEmail) {
            const intervals = sessions
                .filter(s => s.joinTime && s.leaveTime)
                .map(s => ({ start: new Date(s.joinTime), end: new Date(s.leaveTime!) }));
            participantDurations.set(email, calculateUniqueMinutes(intervals));
        }
    }
    
    // Add calendar attendees
    if (calendarEvent?.attendees) {
        for (const attendee of calendarEvent.attendees) {
            if (attendee.email) participantEmails.add(attendee.email.toLowerCase());
        }
    }
    
    // Also make sure the syncing user is added
    if (integration.googleEmail) {
        participantEmails.add(integration.googleEmail.toLowerCase());
    }

    // Map emails to CUOS users
    const matchedUsers = await User.find({ email: { $in: Array.from(participantEmails) }, isActive: true }).select('_id email').lean();
    
    // Also map emails to GoogleIntegrations to catch personal google accounts
    const matchedIntegrations = await GoogleIntegration.find({ googleEmail: { $in: Array.from(participantEmails) } }).select('userId googleEmail').lean();
    
    // Build a map of email -> userId
    const emailToUserId = new Map<string, string>();
    for (const u of matchedUsers) {
        emailToUserId.set(u.email.toLowerCase(), u._id.toString());
    }
    for (const intg of matchedIntegrations as any[]) {
        emailToUserId.set(intg.googleEmail.toLowerCase(), intg.userId.toString());
    }

    const participantsList: any[] = [];
    const addedUserIds = new Set<string>();

    for (const email of participantEmails) {
        const emailLower = email.toLowerCase();
        const mappedUserId = emailToUserId.get(emailLower);
        
        if (mappedUserId) {
            if (!addedUserIds.has(mappedUserId)) {
                participantsList.push({
                    userId: mappedUserId,
                    role: 'required',
                    actualDuration: participantDurations.get(emailLower),
                });
                addedUserIds.add(mappedUserId);
            }
        } else if (emailLower !== integration.googleEmail?.toLowerCase()) {
            participantsList.push({ 
                externalEmail: email, 
                role: 'required',
                actualDuration: participantDurations.get(emailLower),
            });
        }
    }
    
    // Explicitly add syncing user if they aren't matched by email
    if (!addedUserIds.has(userId.toString())) {
        participantsList.push({
            userId,
            role: 'required',
            actualDuration: integration.googleEmail ? participantDurations.get(integration.googleEmail.toLowerCase()) : undefined,
        });
    }

    // Add anonymous users who had no email but were in the meet (not resolved by our logic)
    if (conferenceData?.sessions) {
        const anonymousSessions = conferenceData.sessions.filter(s => !s.email && s.displayName);
        const byName = new Map<string, typeof anonymousSessions>();
        for (const session of anonymousSessions) {
            const name = session.displayName || 'Unknown';
            if (!byName.has(name)) byName.set(name, []);
            byName.get(name)!.push(session);
        }
        for (const [name, sessions] of byName) {
            const intervals = sessions
                .filter(s => s.joinTime && s.leaveTime)
                .map(s => ({ start: new Date(s.joinTime), end: new Date(s.leaveTime!) }));
            participantsList.push({
                name: name,
                role: 'required',
                actualDuration: calculateUniqueMinutes(intervals),
            });
        }
    }

    const updateFields: any = {};

    // Only overwrite actual Meet data if we have it
    if (conferenceData) {
        updateFields.actualStartTime = conferenceData.actualStartTime;
        updateFields.actualEndTime = conferenceData.actualEndTime;
        updateFields.actualDuration = actualDuration;
        updateFields.conferenceStatus = 'ended';
        updateFields.participants = participantsList;
    } else {
        // No real conference data yet — mark as scheduled but link the calendar event
        updateFields.conferenceStatus = 'scheduled';
    }

    // Always link back to the calendar event if we have one
    if (calendarEvent?.id) {
        updateFields.googleCalendarEventId = calendarEvent.id;
    }
    if (calendarEvent?.meetLink) {
        updateFields.meetLink = calendarEvent.meetLink;
    }

    // ── FIX 2: Before upserting a new google_meet meeting, look for an existing CUOS
    // meeting that was created manually with this Google Calendar event or conference ID.
    // This prevents the bug where a manually-created CUOS meeting never gets its actual
    // time updated because the sync job creates a new google_meet document instead.
    let meetingDoc: any = null;

    // Priority 1: match by googleConferenceId (most specific)
    meetingDoc = await Meeting.findOneAndUpdate(
        { googleConferenceId: conferenceId },
        { $set: updateFields },
        { new: true, runValidators: false }
    );

    // Priority 2: if no match by conferenceId, try matching the manual meeting by calendarEventId
    if (!meetingDoc && calendarEvent?.id) {
        meetingDoc = await Meeting.findOneAndUpdate(
            { googleCalendarEventId: calendarEvent.id },
            { $set: { ...updateFields, googleConferenceId: conferenceId } },
            { new: true, runValidators: false }
        );
    }

    // Priority 3: no existing meeting found — create a new google_meet one
    if (!meetingDoc) {
        meetingDoc = await Meeting.findOneAndUpdate(
            { googleConferenceId: conferenceId },
            {
                $setOnInsert: {
                    title,
                    type: 'internal',
                    scheduledAt,
                    duration: scheduledDuration || 1,
                    source: 'google_meet',
                    googleConferenceId: conferenceId,
                    createdBy: userId,
                    accessLevel: 'project-team',
                    participants: participantsList,
                },
                $set: updateFields,
            },
            {
                new: true,
                upsert: true,
                runValidators: false,
            }
        );
    }

    if (!meetingDoc) return [];

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
                // First try direct email match
                const cuosUser = await User.findOne({
                    email: participantEmail.toLowerCase(),
                    isActive: true,
                }).select('_id').lean();
                cuosUserId = cuosUser?._id?.toString();

                // If not found by direct email, try via GoogleIntegration (personal gmail)
                if (!cuosUserId) {
                    const googleIntg = await GoogleIntegration.findOne({
                        googleEmail: participantEmail.toLowerCase(),
                    }).select('userId').lean() as any;
                    cuosUserId = googleIntg?.userId?.toString();
                }
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
        }
    } else if (!conferenceData && calendarEvent) {
        // Fallback: Calendar event only — no conference data available (e.g., external meeting or not yet ended)
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

