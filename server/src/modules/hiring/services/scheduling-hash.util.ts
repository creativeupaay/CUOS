import { createHash } from 'crypto';
import type { IInterviewSchedulingConfig } from '../models/Job.model';

function sortNumbers(values: number[]): number[] {
    return [...values].sort((a, b) => a - b);
}

function sortSlots(slots: Array<{ startTime: string; endTime: string }>) {
    return [...slots].sort((a, b) => {
        if (a.startTime === b.startTime) {
            return a.endTime.localeCompare(b.endTime);
        }
        return a.startTime.localeCompare(b.startTime);
    });
}

export function buildInterviewSchedulingSyncHash(
    scheduling: IInterviewSchedulingConfig | null | undefined
): string {
    if (!scheduling) {
        return '';
    }

    const normalized = {
        enabled: Boolean(scheduling.enabled),
        active: Boolean(scheduling.active),
        timezone: String(scheduling.timezone || ''),
        organizerName: String(scheduling.organizerName || ''),
        availableFrom: scheduling.availableFrom
            ? new Date(scheduling.availableFrom).toISOString()
            : null,
        availableTo: scheduling.availableTo
            ? new Date(scheduling.availableTo).toISOString()
            : null,
        weekdays: sortNumbers(Array.isArray(scheduling.weekdays) ? scheduling.weekdays : []),
        dailySlots: sortSlots(Array.isArray(scheduling.dailySlots) ? scheduling.dailySlots : []),
        durationMinutes: Number(scheduling.durationMinutes || 0),
        slotIntervalMinutes: Number(scheduling.slotIntervalMinutes || 0),
        minimumBookingNoticeMinutes: Number(scheduling.minimumBookingNoticeMinutes || 0),
        beforeEventBufferMinutes: Number(scheduling.beforeEventBufferMinutes || 0),
        afterEventBufferMinutes: Number(scheduling.afterEventBufferMinutes || 0),
    };

    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
