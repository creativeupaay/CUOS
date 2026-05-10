import { Interview } from '../models/Interview.model';
import { sendInterviewReminderForCandidateEmail } from '../../../services/email.service';
import { logger } from '../../../utils/logger';

export const interviewReminderTimers = new Map<string, NodeJS.Timeout>();

export function reminderTimerKey(interviewId: string, reminderMinutesBefore: number): string {
    return `${interviewId}:${reminderMinutesBefore}`;
}

export function clearInterviewReminderTimer(interviewId: string): void {
    for (const [key, timer] of interviewReminderTimers.entries()) {
        if (!key.startsWith(`${interviewId}:`)) {
            continue;
        }
        clearTimeout(timer);
        interviewReminderTimers.delete(key);
    }
}

export function normalizeReminderMinutes(value: unknown): number[] {
    const raw = Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : [];
    const normalized = raw
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item >= 0)
        .map((item) => Math.floor(item));

    const uniqueSorted = Array.from(new Set(normalized)).sort((a, b) => a - b);
    return uniqueSorted.length ? uniqueSorted : [];
}

export async function sendInterviewReminderEmailIfValid(input: {
    interviewId: string;
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
    interviewer: string;
    scheduledTime: Date;
    meetLink: string;
    reminderMinutesBefore: number;
}): Promise<void> {
    const interview = await Interview.findById(input.interviewId).select(
        'status scheduledTime reminderSentAt reminderOffsetsSent'
    );
    if (!interview) {
        return;
    }

    if (interview.status === 'cancelled' || interview.status === 'completed' || interview.status === 'no-show') {
        return;
    }

    const sentOffsets = Array.isArray((interview as any).reminderOffsetsSent)
        ? ((interview as any).reminderOffsetsSent as number[])
        : [];

    if (sentOffsets.includes(input.reminderMinutesBefore)) {
        return;
    }

    const expectedTime = input.scheduledTime.getTime();
    if (interview.scheduledTime.getTime() !== expectedTime) {
        return;
    }

    if (input.scheduledTime.getTime() <= Date.now()) {
        return;
    }

    await sendInterviewReminderForCandidateEmail({
        to: input.candidateEmail,
        candidateName: input.candidateName,
        jobTitle: input.jobTitle,
        interviewer: input.interviewer,
        scheduledTime: input.scheduledTime,
        meetLink: input.meetLink,
    });

    await Interview.findByIdAndUpdate(input.interviewId, {
        reminderSentAt: new Date(),
        $addToSet: {
            reminderOffsetsSent: input.reminderMinutesBefore,
        },
    });
}

export function scheduleInterviewReminder(input: {
    interviewId: string;
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
    interviewer: string;
    scheduledTime: Date;
    meetLink: string;
    reminderMinutesBefore: number;
}): void {
    if (input.reminderMinutesBefore <= 0) {
        return;
    }

    const reminderAt = input.scheduledTime.getTime() - input.reminderMinutesBefore * 60 * 1000;
    const delay = reminderAt - Date.now();

    if (delay <= 0) {
        sendInterviewReminderEmailIfValid(input).catch((error) => {
            logger.error({ context: error }, 'Failed sending immediate interview reminder:');
        });
        return;
    }

    const timerKey = reminderTimerKey(input.interviewId, input.reminderMinutesBefore);
    const existingTimer = interviewReminderTimers.get(timerKey);
    if (existingTimer) {
        clearTimeout(existingTimer);
        interviewReminderTimers.delete(timerKey);
    }

    const timer = setTimeout(() => {
        sendInterviewReminderEmailIfValid(input)
            .catch((error) => {
                logger.error({ context: error }, 'Failed sending scheduled interview reminder:');
            })
            .finally(() => {
                interviewReminderTimers.delete(timerKey);
            });
    }, delay);

    interviewReminderTimers.set(timerKey, timer);
}
