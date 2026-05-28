// Shared local types for ScheduleFormState used across InterviewSchedule components
// These mirror the monolith's internal types, scoped to this feature

export type ReminderUnit = 'minutes' | 'hours' | 'days';

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
