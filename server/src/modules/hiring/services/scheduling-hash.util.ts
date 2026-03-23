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

function sortRanges(
    ranges: Array<{
        startDate: string | Date;
        endDate: string | Date;
        weekdays?: number[];
        dailySlots?: Array<{ startTime: string; endTime: string }>;
    }>
): Array<{
    startDate: string;
    endDate: string;
    weekdays: number[];
    dailySlots: Array<{ startTime: string; endTime: string }>;
}> {
    return [...ranges]
        .map((range) => ({
            startDate: new Date(range.startDate).toISOString(),
            endDate: new Date(range.endDate).toISOString(),
            weekdays: sortNumbers(Array.isArray(range.weekdays) ? range.weekdays : []),
            dailySlots: sortSlots(Array.isArray(range.dailySlots) ? range.dailySlots : []),
        }))
        .sort((a, b) => {
            if (a.startDate === b.startDate) {
                return a.endDate.localeCompare(b.endDate);
            }
            return a.startDate.localeCompare(b.startDate);
        });
}

function sortDateOverrides(
    overrides: Array<{
        date: string | Date;
        slots: Array<{ startTime: string; endTime: string }>;
    }>
) {
    return [...overrides]
        .map((override) => ({
            date: new Date(override.date).toISOString().slice(0, 10),
            slots: sortSlots(Array.isArray(override.slots) ? override.slots : []),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
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
        availableRanges: sortRanges(
            Array.isArray((scheduling as any).availableRanges) ? (scheduling as any).availableRanges : []
        ),
        dateOverrides: sortDateOverrides(
            Array.isArray((scheduling as any).dateOverrides) ? (scheduling as any).dateOverrides : []
        ),
        weekdays: sortNumbers(Array.isArray(scheduling.weekdays) ? scheduling.weekdays : []),
        dailySlots: sortSlots(Array.isArray(scheduling.dailySlots) ? scheduling.dailySlots : []),
        durationMinutes: Number(scheduling.durationMinutes || 0),
        beforeEventBufferMinutes: Number(scheduling.beforeEventBufferMinutes || 0),
        afterEventBufferMinutes: Number(scheduling.afterEventBufferMinutes || 0),
        reminderMinutesBefore: sortNumbers(
            Array.isArray((scheduling as any).reminderMinutesBefore)
                ? (scheduling as any).reminderMinutesBefore
                : []
        ),
    };

    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
