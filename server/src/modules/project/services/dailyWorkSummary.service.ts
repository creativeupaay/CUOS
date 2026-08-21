/**
 * dailyWorkSummary.service.ts
 *
 * Calculates unique working time for an employee on a given date.
 *
 * KEY PRINCIPLE:
 * Raw category totals (tasks, meetings) are preserved for display,
 * but uniqueWorkedMinutes is calculated using the interval union
 * algorithm so overlapping time is never double-counted.
 *
 * Example:
 *   Task:    09:00–15:00 = 360 min
 *   Meeting: 13:00–15:00 = 120 min
 *   Raw sum: 480 min — WRONG
 *   Unique:  360 min — CORRECT (09:00–15:00)
 */

import { TimeLog } from '../models/TimeLog.model';
import { DaySession } from '../models/DaySession.model';
import { MeetingAttendance } from '../../integration/models/MeetingAttendance.model';
import { Employee } from '../../hrms/models/Employee.model';
import { calculateDayUniqueMinutes, getWorkDayBounds, type Interval } from '../../../utils/intervalUtils';
import { logger } from '../../../utils/logger';
import type { Types } from 'mongoose';

export interface DailyWorkSummary {
    date: string;       // YYYY-MM-DD (UTC)
    userId: string;
    /** Daily target in minutes — from Employee.workSchedule.hoursPerDay */
    requiredMinutes: number;
    /** Raw sum of task TimeLog durations (may overlap with meetings) */
    taskLoggedMinutes: number;
    /** Raw sum of meeting attendance durations (may overlap with tasks) */
    meetingLoggedMinutes: number;
    /** Other TimeLogs (e.g. unallocated time) */
    otherLoggedMinutes: number;
    /** UNIQUE working minutes — interval union of all work sources */
    uniqueWorkedMinutes: number;
    /** max(required - unique, 0) */
    remainingMinutes: number;
    /** max(unique - required, 0) */
    overtimeMinutes: number;
    /** The merged intervals (useful for timeline display) */
    workIntervals: Array<{ start: string; end: string }>;
}

/**
 * Calculate the daily work summary for a user on a specific UTC date.
 *
 * @param userId - CUOS User._id as string
 * @param dateStr - UTC date in YYYY-MM-DD format
 */
export async function calculateDailyWorkSummary(
    userId: string,
    dateStr: string
): Promise<DailyWorkSummary> {
    // Use 6am IST (00:30 UTC) work day boundaries instead of UTC midnight.
    // This ensures employees who work past midnight (up to 6am IST) have
    // their work counted in the correct day.
    const { dayStart, dayEnd } = getWorkDayBounds(dateStr);

    // ── 1. Get daily target from Employee work schedule ──────────────────────
    let requiredMinutes = 480; // fallback: 8h
    try {
        const employee = await Employee.findOne({ userId }).select('workSchedule').lean();
        if (employee?.workSchedule?.hoursPerDay) {
            requiredMinutes = employee.workSchedule.hoursPerDay * 60;
        }
    } catch (err) {
        logger.warn({ userId, err }, '[DailyWork] Could not find Employee — using 8h default');
    }

    // ── 2. Fetch task TimeLogs for this user on this day ─────────────────────
    const timeLogs = await TimeLog.find({
        userId,
        date: { $gte: dayStart, $lte: dayEnd },
    }).lean();

    let taskLoggedMinutes = 0;
    let meetingLoggedMinutes = 0;
    let otherLoggedMinutes = 0;
    const allIntervals: Interval[] = [];
    let nextSyntheticStart = new Date(dayStart);

    for (const log of timeLogs) {
        const duration = log.duration ?? 0; // minutes

        // Categorize the TimeLog
        const desc = log.description ?? '';
        if (desc === 'Unallocated Time') {
            otherLoggedMinutes += duration;
        } else if (desc.startsWith('Meeting:') || (log as any).source === 'google_meet') {
            meetingLoggedMinutes += duration;
        } else {
            taskLoggedMinutes += duration;
        }

        // Build interval if startTime + endTime are available
        if (log.startTime && log.endTime) {
            allIntervals.push({ start: new Date(log.startTime), end: new Date(log.endTime) });
        } else {
            // TimeLog without explicit times — use work day start + duration as a synthetic interval.
            // This is imprecise but prevents data loss.
            // Stack them sequentially using nextSyntheticStart so they don't overlap with each other.
            const syntheticStart = new Date(nextSyntheticStart);
            const syntheticEnd   = new Date(syntheticStart.getTime() + duration * 60_000);
            allIntervals.push({ start: syntheticStart, end: syntheticEnd });
            nextSyntheticStart = syntheticEnd;
        }
    }

    // ── 2.5 Fetch active DaySession (timer) for this day ────────────────────
    // If the user hasn't clicked "End Day" yet, their TimeLogs might be empty.
    // By including the entire elapsed DaySession as a single interval, we ensure
    // their ongoing attendance is counted correctly in uniqueWorkedMinutes.
    const daySession = await DaySession.findOne({ userId, dateKey: dateStr }).lean();
    if (daySession) {
        let elapsedSeconds = daySession.accumulated || 0;
        if (daySession.status === 'running' && daySession.startedAt) {
            elapsedSeconds += Math.floor((Date.now() - daySession.startedAt) / 1000);
        }
        
        // Only cap at 12 hours if they didn't manually bypass the limit
        const limitSeconds = 12 * 60 * 60;
        if (!daySession.limitBypassed && elapsedSeconds > limitSeconds) {
            elapsedSeconds = limitSeconds;
        }
        
        if (elapsedSeconds > 0) {
            const sessionStart = daySession.dayStart ? new Date(daySession.dayStart) : new Date(dayStart);
            const sessionEnd = new Date(sessionStart.getTime() + elapsedSeconds * 1000);
            allIntervals.push({ start: sessionStart, end: sessionEnd });
            
            // Also attribute this to 'other' if we have no TimeLogs yet, 
            // so the dashboard shows the hours before they are categorized on End Day.
            if (timeLogs.length === 0) {
                otherLoggedMinutes = Math.floor(elapsedSeconds / 60);
            }
        }
    }

    // ── 3. Fetch MeetingAttendance sessions for this user on this day ────────
    // These are stored separately from TimeLogs to preserve raw attendance data.
    const attendanceRecords = await MeetingAttendance.find({
        userId,
    }).populate({
        path: 'meetingId',
        select: 'scheduledAt actualStartTime actualEndTime',
    }).lean();

    for (const att of attendanceRecords) {
        // Check if meeting falls on the requested day
        const meeting = att.meetingId as any;
        const meetingStart = meeting?.actualStartTime ?? meeting?.scheduledAt;
        if (!meetingStart) continue;

        const meetingDate = new Date(meetingStart);
        if (meetingDate < dayStart || meetingDate > dayEnd) continue;

        // Add session intervals for this attendance record
        for (const session of att.sessions ?? []) {
            if (!session.joinTime || !session.leaveTime) continue;
            const joinTime  = new Date(session.joinTime);
            const leaveTime = new Date(session.leaveTime);
            if (joinTime < leaveTime) {
                allIntervals.push({ start: joinTime, end: leaveTime });
                // Track meeting minutes separately for display
                const sessionMinutes = Math.round((leaveTime.getTime() - joinTime.getTime()) / 60_000);
                meetingLoggedMinutes += sessionMinutes;
            }
        }
    }

    // ── 4. Calculate unique worked minutes ───────────────────────────────────
    const uniqueWorkedMinutes = calculateDayUniqueMinutes(allIntervals, dateStr);

    // ── 5. Remaining and overtime ─────────────────────────────────────────────
    const remainingMinutes = Math.max(requiredMinutes - uniqueWorkedMinutes, 0);
    const overtimeMinutes  = Math.max(uniqueWorkedMinutes - requiredMinutes, 0);

    // ── 6. Build merged work intervals for timeline display ──────────────────
    const { mergeIntervals, filterIntervalsForDay, splitAtWorkDayBoundary } = await import('../../../utils/intervalUtils');

    // Split work-day-crossing intervals first
    const expandedIntervals: Interval[] = [];
    for (const iv of allIntervals) {
        expandedIntervals.push(...splitAtWorkDayBoundary(iv));
    }
    const mergedForDay = filterIntervalsForDay(mergeIntervals(expandedIntervals), dateStr);

    return {
        date: dateStr,
        userId,
        requiredMinutes,
        taskLoggedMinutes,
        meetingLoggedMinutes,
        otherLoggedMinutes,
        uniqueWorkedMinutes,
        remainingMinutes,
        overtimeMinutes,
        workIntervals: mergedForDay.map(iv => ({
            start: iv.start.toISOString(),
            end: iv.end.toISOString(),
        })),
    };
}
