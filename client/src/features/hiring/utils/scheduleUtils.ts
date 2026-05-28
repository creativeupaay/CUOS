/**
 * Schedule Utilities for HiringInterviewSchedulePage
 * Extracted from the monolithic page component.
 */

import type { Job } from '../types/types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const WEEKDAY_OPTIONS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
] as const;

export const REMINDER_OPTIONS = [
    { label: '30 minutes before', value: 30 },
    { label: '2 hours before', value: 120 },
    { label: '1 day before', value: 1440 },
] as const;

export const REMINDER_UNITS = [
    { label: 'Minutes', value: 'minutes', multiplier: 1 },
    { label: 'Hours', value: 'hours', multiplier: 60 },
    { label: 'Days', value: 'days', multiplier: 1440 },
] as const;

export type ReminderUnit = (typeof REMINDER_UNITS)[number]['value'];

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DayScheduleMap = Record<
    number,
    {
        enabled: boolean;
        slots: Array<{ startTime: string; endTime: string }>;
    }
>;

export interface ScheduleRangeFormState {
    startDate: string;
    endDate: string;
    daySchedules: DayScheduleMap;
}

export interface ScheduleFormState {
    enabled: boolean;
    timezone: string;
    organizerName: string;
    availableRanges: ScheduleRangeFormState[];
    dateOverrides: Array<{
        date: string;
        slots: Array<{ startTime: string; endTime: string }>;
    }>;
    daySchedules: DayScheduleMap;
    durationMinutes: number;
    beforeEventBufferMinutes: number;
    afterEventBufferMinutes: number;
    reminderMinutesBefore: number[];
    customReminderValue: string;
    customReminderUnit: ReminderUnit;
}

// ─── Pure Helper Functions ────────────────────────────────────────────────────

export function toLocalDateInput(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getTodayLocalDateInput(): string {
    const today = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

export function formatDateForSummary(value?: string | Date): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatWeekdaysForSummary(days?: number[]): string {
    if (!Array.isArray(days) || days.length === 0) return '-';
    const labels = days
        .slice()
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_OPTIONS.find((item) => item.value === day)?.label)
        .filter(Boolean);
    return labels.length ? labels.join(', ') : '-';
}

export function formatRangesForSummary(
    ranges?: Array<{ startDate?: string; endDate?: string }>,
): string {
    if (!Array.isArray(ranges) || ranges.length === 0) return '-';
    const labels = ranges
        .map((range) => {
            const start = formatDateForSummary(range.startDate);
            const end = formatDateForSummary(range.endDate);
            if (start === '-' || end === '-') return '';
            return `${start} to ${end}`;
        })
        .filter(Boolean);
    return labels.length ? labels.join(' | ') : '-';
}

export function formatReminderLabel(minutes: number): string {
    if (minutes % 1440 === 0) {
        const days = minutes / 1440;
        return `${days} day${days > 1 ? 's' : ''} before`;
    }
    if (minutes % 60 === 0) {
        const hours = minutes / 60;
        return `${hours} hour${hours > 1 ? 's' : ''} before`;
    }
    return `${minutes} minute${minutes > 1 ? 's' : ''} before`;
}

export function toLocalDayBoundaryIso(value: string, mode: 'start' | 'end'): string {
    if (!value) return '';
    const datePart = value.slice(0, 10);
    const boundary =
        mode === 'start'
            ? new Date(`${datePart}T00:00:00`)
            : new Date(`${datePart}T23:59:59.999`);
    if (Number.isNaN(boundary.getTime())) return '';
    return boundary.toISOString();
}

// ─── DaySchedule Helpers ──────────────────────────────────────────────────────

export function createDaySchedulesFromWeekdaysAndSlots(
    weekdays?: number[],
    slots?: Array<{ startTime: string; endTime: string }>,
): DayScheduleMap {
    const defaultSlots = slots?.length
        ? slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
        : [{ startTime: '10:00', endTime: '18:00' }];
    const enabledWeekdays = weekdays?.length ? weekdays : [1, 2, 3, 4, 5];

    const map: DayScheduleMap = {
        0: { enabled: false, slots: defaultSlots.map((s) => ({ ...s })) },
        1: { enabled: false, slots: defaultSlots.map((s) => ({ ...s })) },
        2: { enabled: false, slots: defaultSlots.map((s) => ({ ...s })) },
        3: { enabled: false, slots: defaultSlots.map((s) => ({ ...s })) },
        4: { enabled: false, slots: defaultSlots.map((s) => ({ ...s })) },
        5: { enabled: false, slots: defaultSlots.map((s) => ({ ...s })) },
        6: { enabled: false, slots: defaultSlots.map((s) => ({ ...s })) },
    };
    enabledWeekdays.forEach((day) => {
        map[day] = { enabled: true, slots: defaultSlots.map((s) => ({ ...s })) };
    });
    return map;
}

export function cloneDaySchedules(daySchedules: DayScheduleMap): DayScheduleMap {
    return Object.fromEntries(
        Object.entries(daySchedules).map(([day, config]) => [
            Number(day),
            { enabled: config.enabled, slots: config.slots.map((s) => ({ ...s })) },
        ]),
    ) as DayScheduleMap;
}

export function getEnabledDaysFromDaySchedules(daySchedules: DayScheduleMap): number[] {
    return WEEKDAY_OPTIONS.filter((day) => daySchedules[day.value]?.enabled).map((d) => d.value);
}

export function getSortedSlotsFromDaySchedules(
    daySchedules: DayScheduleMap,
): Array<{ startTime: string; endTime: string }> {
    const enabledDays = getEnabledDaysFromDaySchedules(daySchedules);
    const sourceDay = enabledDays[0];
    return sourceDay !== undefined
        ? [...daySchedules[sourceDay].slots].sort((a, b) => a.startTime.localeCompare(b.startTime))
        : [{ startTime: '10:00', endTime: '18:00' }];
}

export function summarizeDaySchedules(daySchedules: DayScheduleMap): string {
    const activeDays = WEEKDAY_OPTIONS.filter((day) => daySchedules[day.value]?.enabled);
    if (!activeDays.length) return 'No active working days';
    const first = activeDays[0].label;
    const last = activeDays[activeDays.length - 1].label;
    const firstSchedule = daySchedules[activeDays[0].value];
    const slotLabel = firstSchedule.slots.map((s) => `${s.startTime} - ${s.endTime}`).join(', ');
    return `${first}${activeDays.length > 1 ? ` - ${last}` : ''}, ${slotLabel}`;
}

// ─── Form State Builders ──────────────────────────────────────────────────────

export function buildDaySchedulesFromScheduling(
    scheduling?: Job['interviewScheduling'],
): DayScheduleMap {
    return createDaySchedulesFromWeekdaysAndSlots(scheduling?.weekdays, scheduling?.dailySlots);
}

export function buildFormStateFromScheduling(scheduling?: Job['interviewScheduling']): ScheduleFormState {
    const availableRanges = Array.isArray(scheduling?.availableRanges)
        ? scheduling!.availableRanges
              .map((range) => ({
                  startDate: toLocalDateInput(range.startDate),
                  endDate: toLocalDateInput(range.endDate),
                  daySchedules: createDaySchedulesFromWeekdaysAndSlots(
                      range.weekdays?.length ? range.weekdays : scheduling?.weekdays,
                      range.dailySlots?.length ? range.dailySlots : scheduling?.dailySlots,
                  ),
              }))
              .filter((range) => range.startDate || range.endDate)
        : [];

    const reminderMinutesBefore = Array.isArray(scheduling?.reminderMinutesBefore)
        ? scheduling!.reminderMinutesBefore
        : typeof scheduling?.reminderMinutesBefore === 'number'
          ? [scheduling.reminderMinutesBefore]
          : [30];

    const dateOverrides = Array.isArray(scheduling?.dateOverrides)
        ? scheduling!.dateOverrides
              .map((override) => ({
                  date: toLocalDateInput(override.date),
                  slots:
                      Array.isArray(override.slots) && override.slots.length
                          ? override.slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
                          : [{ startTime: '10:00', endTime: '18:00' }],
              }))
              .filter((o) => o.date)
        : [];

    return {
        enabled: Boolean(scheduling?.enabled),
        timezone: scheduling?.timezone || 'Asia/Kolkata',
        organizerName: scheduling?.organizerName || 'HR Team',
        availableRanges: availableRanges.length
            ? availableRanges
            : [{ startDate: '', endDate: '', daySchedules: buildDaySchedulesFromScheduling(scheduling) }],
        dateOverrides,
        daySchedules: buildDaySchedulesFromScheduling(scheduling),
        durationMinutes: scheduling?.durationMinutes || 45,
        beforeEventBufferMinutes: scheduling?.beforeEventBufferMinutes || 5,
        afterEventBufferMinutes: scheduling?.afterEventBufferMinutes || 5,
        reminderMinutesBefore,
        customReminderValue: '',
        customReminderUnit: 'minutes',
    };
}

export const EMPTY_FORM: ScheduleFormState = {
    enabled: false,
    timezone: 'Asia/Kolkata',
    organizerName: 'HR Team',
    availableRanges: [
        {
            startDate: '',
            endDate: '',
            daySchedules: createDaySchedulesFromWeekdaysAndSlots([1, 2, 3, 4, 5], [
                { startTime: '09:00', endTime: '17:00' },
            ]),
        },
    ],
    dateOverrides: [],
    daySchedules: {
        0: { enabled: false, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        1: { enabled: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        2: { enabled: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        3: { enabled: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        4: { enabled: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        5: { enabled: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        6: { enabled: false, slots: [{ startTime: '09:00', endTime: '17:00' }] },
    },
    durationMinutes: 45,
    beforeEventBufferMinutes: 5,
    afterEventBufferMinutes: 5,
    reminderMinutesBefore: [30],
    customReminderValue: '',
    customReminderUnit: 'minutes',
};
