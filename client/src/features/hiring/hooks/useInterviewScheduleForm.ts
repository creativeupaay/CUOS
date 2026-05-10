import { useState, useMemo, useCallback } from 'react';
import {
    type ScheduleFormState,
    type DayScheduleMap,
    REMINDER_UNITS,
    EMPTY_FORM,
    cloneDaySchedules,
    buildFormStateFromScheduling,
    getEnabledDaysFromDaySchedules,
    getSortedSlotsFromDaySchedules,
    toLocalDayBoundaryIso,
    summarizeDaySchedules,
} from '../utils/scheduleUtils';
import type { Job } from '../types/types';

// ─── Validation Helper ────────────────────────────────────────────────────────

function validateDaySlots(slots: Array<{ startTime: string; endTime: string }>): boolean {
    return slots.every(
        (slot) => slot.startTime && slot.endTime && slot.startTime < slot.endTime,
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseScheduleFormReturn {
    form: ScheduleFormState;
    errors: { schedule?: string };
    activeRangeIndex: number;
    setActiveRangeIndex: (index: number) => void;
    copiedRangeDaySchedules: DayScheduleMap | null;
    copiedRangeLabel: string;
    workingHoursSummary: string;
    availableRangeDates: string[];
    // Field setters
    setFormField: (key: keyof ScheduleFormState, value: unknown) => void;
    toggleWeekday: (day: number) => void;
    setRangeValue: (index: number, field: 'startDate' | 'endDate', value: string) => void;
    addRange: () => void;
    removeRange: (index: number) => void;
    toggleReminderOption: (minutes: number) => void;
    addCustomReminder: () => void;
    removeReminder: (minutes: number) => void;
    addDateOverride: (availableRangeDates: string[]) => void;
    removeDateOverride: (index: number) => void;
    setDateOverrideDate: (index: number, value: string) => void;
    setDateOverrideSlotTime: (overrideIndex: number, slotIndex: number, field: 'startTime' | 'endTime', value: string) => void;
    addDateOverrideSlot: (overrideIndex: number) => void;
    removeDateOverrideSlot: (overrideIndex: number, slotIndex: number) => void;
    setDaySlotTimeAtIndex: (day: number, slotIndex: number, field: 'startTime' | 'endTime', value: string) => void;
    addDaySlot: (day: number) => void;
    removeDaySlot: (day: number, slotIndex: number) => void;
    copyDayScheduleFromRange: () => void;
    applyDayScheduleCopy: () => void;
    // Actions
    loadFromJob: (job: Job | undefined) => void;
    buildSchedulingPayload: () => Record<string, unknown>;
    clearErrors: () => void;
}

export function useScheduleForm(): UseScheduleFormReturn {
    const [form, setForm] = useState<ScheduleFormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<{ schedule?: string }>({});
    const [activeRangeIndex, setActiveRangeIndex] = useState(0);
    const [copiedRangeDaySchedules, setCopiedRangeDaySchedules] = useState<DayScheduleMap | null>(null);
    const [copiedRangeLabel, setCopiedRangeLabel] = useState('');

    // Compute a clamped index to avoid setState-in-effect cascades
    const safeActiveRangeIndex = Math.min(activeRangeIndex, Math.max(0, form.availableRanges.length - 1));

    const activeRange = form.availableRanges[safeActiveRangeIndex];
    const activeRangeDaySchedules = activeRange?.daySchedules ?? form.daySchedules;

    const workingHoursSummary = useMemo(
        () => summarizeDaySchedules(activeRangeDaySchedules),
        [activeRangeDaySchedules],
    );

    const availableRangeDates = useMemo(() => {
        const dates: string[] = [];
        const seen = new Set<string>();
        form.availableRanges.forEach((range) => {
            if (!range.startDate || !range.endDate) return;
            const start = new Date(`${range.startDate}T00:00:00`);
            const end = new Date(`${range.endDate}T00:00:00`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return;
            const cursor = new Date(start);
            while (cursor <= end) {
                const iso = cursor.toISOString().slice(0, 10);
                if (!seen.has(iso)) { seen.add(iso); dates.push(iso); }
                cursor.setDate(cursor.getDate() + 1);
            }
        });
        return dates.sort();
    }, [form.availableRanges]);

    // ── Helpers ──────────────────────────────────────────────────────────────

    const clearErrors = useCallback(() => setErrors({}), []);

    const setFormField = useCallback((key: keyof ScheduleFormState, value: unknown) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        clearErrors();
    }, [clearErrors]);

    // ── Weekday handlers ─────────────────────────────────────────────────────

    const toggleWeekday = useCallback((day: number) => {
        setForm((prev) => ({
            ...prev,
            availableRanges: prev.availableRanges.map((range, index) =>
                index === safeActiveRangeIndex
                    ? {
                          ...range,
                          daySchedules: {
                              ...range.daySchedules,
                              [day]: { ...range.daySchedules[day], enabled: !range.daySchedules[day].enabled },
                          },
                      }
                    : range,
            ),
        }));
        clearErrors();
    }, [safeActiveRangeIndex, clearErrors]);

    // ── Range handlers ───────────────────────────────────────────────────────

    const setRangeValue = useCallback(
        (index: number, field: 'startDate' | 'endDate', value: string) => {
            setForm((prev) => ({
                ...prev,
                availableRanges: prev.availableRanges.map((range, idx) =>
                    idx === index ? { ...range, [field]: value } : range,
                ),
            }));
            clearErrors();
        },
        [clearErrors],
    );

    const addRange = useCallback(() => {
        setForm((prev) => {
            const sourceDaySchedules =
                prev.availableRanges[safeActiveRangeIndex]?.daySchedules ?? prev.daySchedules;
            const next = [
                ...prev.availableRanges,
                { startDate: '', endDate: '', daySchedules: cloneDaySchedules(sourceDaySchedules) },
            ];
            setActiveRangeIndex(next.length - 1);
            return { ...prev, availableRanges: next };
        });
        clearErrors();
    }, [safeActiveRangeIndex, clearErrors]);

    const removeRange = useCallback((index: number) => {
        setForm((prev) => {
            const next = prev.availableRanges.filter((_, idx) => idx !== index);
            return {
                ...prev,
                availableRanges: next.length
                    ? next
                    : [{ startDate: '', endDate: '', daySchedules: cloneDaySchedules(prev.daySchedules) }],
            };
        });
        setActiveRangeIndex((prev) => (prev > 0 && prev >= index ? prev - 1 : 0));
        clearErrors();
    }, [clearErrors]);

    // ── Reminder handlers ────────────────────────────────────────────────────

    const toggleReminderOption = useCallback((minutes: number) => {
        setForm((prev) => {
            const exists = prev.reminderMinutesBefore.includes(minutes);
            const next = exists
                ? prev.reminderMinutesBefore.filter((v) => v !== minutes)
                : [...prev.reminderMinutesBefore, minutes];
            return { ...prev, reminderMinutesBefore: next.length ? next.sort((a, b) => a - b) : [] };
        });
        clearErrors();
    }, [clearErrors]);

    const addCustomReminder = useCallback(() => {
        const parsed = Number(form.customReminderValue);
        if (!Number.isFinite(parsed) || parsed < 0) return;
        const selectedUnit = REMINDER_UNITS.find((u) => u.value === form.customReminderUnit);
        const multiplier = selectedUnit?.multiplier ?? 1;
        const value = Math.floor(parsed) * multiplier;
        setForm((prev) => ({
            ...prev,
            reminderMinutesBefore: Array.from(new Set([...prev.reminderMinutesBefore, value])).sort((a, b) => a - b),
            customReminderValue: '',
        }));
        clearErrors();
    }, [form.customReminderValue, form.customReminderUnit, clearErrors]);

    const removeReminder = useCallback((minutes: number) => {
        setForm((prev) => ({
            ...prev,
            reminderMinutesBefore: prev.reminderMinutesBefore.filter((v) => v !== minutes),
        }));
        clearErrors();
    }, [clearErrors]);

    // ── Date override handlers ────────────────────────────────────────────────

    const addDateOverride = useCallback((dates: string[]) => {
        const defaultDate =
            dates.find((date) => !form.dateOverrides.some((o) => o.date === date)) || dates[0] || '';
        setForm((prev) => ({
            ...prev,
            dateOverrides: [...prev.dateOverrides, { date: defaultDate, slots: [{ startTime: '10:00', endTime: '18:00' }] }],
        }));
        clearErrors();
    }, [form.dateOverrides, clearErrors]);

    const removeDateOverride = useCallback((index: number) => {
        setForm((prev) => ({ ...prev, dateOverrides: prev.dateOverrides.filter((_, idx) => idx !== index) }));
        clearErrors();
    }, [clearErrors]);

    const setDateOverrideDate = useCallback((index: number, value: string) => {
        setForm((prev) => ({
            ...prev,
            dateOverrides: prev.dateOverrides.map((o, idx) => (idx === index ? { ...o, date: value } : o)),
        }));
        clearErrors();
    }, [clearErrors]);

    const setDateOverrideSlotTime = useCallback(
        (overrideIndex: number, slotIndex: number, field: 'startTime' | 'endTime', value: string) => {
            setForm((prev) => ({
                ...prev,
                dateOverrides: prev.dateOverrides.map((o, idx) =>
                    idx !== overrideIndex
                        ? o
                        : { ...o, slots: o.slots.map((s, si) => (si === slotIndex ? { ...s, [field]: value } : s)) },
                ),
            }));
            clearErrors();
        },
        [clearErrors],
    );

    const addDateOverrideSlot = useCallback((overrideIndex: number) => {
        setForm((prev) => ({
            ...prev,
            dateOverrides: prev.dateOverrides.map((o, idx) => {
                if (idx !== overrideIndex) return o;
                const last = o.slots[o.slots.length - 1] || { startTime: '10:00', endTime: '18:00' };
                return { ...o, slots: [...o.slots, { ...last }] };
            }),
        }));
        clearErrors();
    }, [clearErrors]);

    const removeDateOverrideSlot = useCallback((overrideIndex: number, slotIndex: number) => {
        setForm((prev) => ({
            ...prev,
            dateOverrides: prev.dateOverrides.map((o, idx) => {
                if (idx !== overrideIndex || o.slots.length <= 1) return o;
                return { ...o, slots: o.slots.filter((_, si) => si !== slotIndex) };
            }),
        }));
        clearErrors();
    }, [clearErrors]);

    // ── Day slot handlers ────────────────────────────────────────────────────

    const setDaySlotTimeAtIndex = useCallback(
        (day: number, slotIndex: number, field: 'startTime' | 'endTime', value: string) => {
            setForm((prev) => ({
                ...prev,
                availableRanges: prev.availableRanges.map((range, index) =>
                    index !== safeActiveRangeIndex
                        ? range
                        : {
                              ...range,
                              daySchedules: {
                                  ...range.daySchedules,
                                  [day]: {
                                      ...range.daySchedules[day],
                                      slots: range.daySchedules[day].slots.map((s, si) =>
                                          si === slotIndex ? { ...s, [field]: value } : s,
                                      ),
                                  },
                              },
                          },
                ),
            }));
            clearErrors();
        },
        [safeActiveRangeIndex, clearErrors],
    );

    const addDaySlot = useCallback((day: number) => {
        setForm((prev) => ({
            ...prev,
            availableRanges: prev.availableRanges.map((range, index) => {
                if (index !== safeActiveRangeIndex) return range;
                const last = range.daySchedules[day].slots.at(-1) || { startTime: '10:00', endTime: '18:00' };
                return {
                    ...range,
                    daySchedules: {
                        ...range.daySchedules,
                        [day]: { ...range.daySchedules[day], slots: [...range.daySchedules[day].slots, { ...last }] },
                    },
                };
            }),
        }));
        clearErrors();
    }, [safeActiveRangeIndex, clearErrors]);

    const removeDaySlot = useCallback((day: number, slotIndex: number) => {
        setForm((prev) => ({
            ...prev,
            availableRanges: prev.availableRanges.map((range, index) => {
                if (index !== safeActiveRangeIndex || range.daySchedules[day].slots.length <= 1) return range;
                return {
                    ...range,
                    daySchedules: {
                        ...range.daySchedules,
                        [day]: {
                            ...range.daySchedules[day],
                            slots: range.daySchedules[day].slots.filter((_, si) => si !== slotIndex),
                        },
                    },
                };
            }),
        }));
        clearErrors();
    }, [safeActiveRangeIndex, clearErrors]);

    // ── Copy day schedule ────────────────────────────────────────────────────

    const copyDayScheduleFromRange = useCallback(() => {
        const daySchedules = form.availableRanges[safeActiveRangeIndex]?.daySchedules;
        if (!daySchedules) return;
        setCopiedRangeDaySchedules(cloneDaySchedules(daySchedules));
        setCopiedRangeLabel(`Range ${safeActiveRangeIndex + 1}`);
    }, [form.availableRanges, safeActiveRangeIndex]);

    const applyDayScheduleCopy = useCallback(() => {
        if (!copiedRangeDaySchedules) return;
        setForm((prev) => ({
            ...prev,
            availableRanges: prev.availableRanges.map((range, index) =>
                index === safeActiveRangeIndex
                    ? { ...range, daySchedules: cloneDaySchedules(copiedRangeDaySchedules) }
                    : range,
            ),
        }));
    }, [copiedRangeDaySchedules, safeActiveRangeIndex]);

    // ── Load from job ────────────────────────────────────────────────────────

    const loadFromJob = useCallback((job: Job | undefined) => {
        if (!job) return;
        setForm(buildFormStateFromScheduling(job.interviewScheduling));
        setActiveRangeIndex(0);
        setErrors({});
    }, []);

    // ── Build payload ────────────────────────────────────────────────────────

    const buildSchedulingPayload = useCallback(() => {
        const primaryRange = form.availableRanges[0];
        const primaryDaySchedules = primaryRange?.daySchedules || form.daySchedules;
        const primaryEnabledDays = getEnabledDaysFromDaySchedules(primaryDaySchedules);
        const sortedSlots = getSortedSlotsFromDaySchedules(primaryDaySchedules);

        return {
            interviewScheduling: {
                enabled: form.enabled,
                active: form.enabled,
                timezone: form.timezone,
                organizerName: form.organizerName,
                availableRanges: form.availableRanges
                    .filter((range) => range.startDate && range.endDate)
                    .map((range) => ({
                        startDate: toLocalDayBoundaryIso(range.startDate, 'start'),
                        endDate: toLocalDayBoundaryIso(range.endDate, 'end'),
                        weekdays: getEnabledDaysFromDaySchedules(range.daySchedules),
                        dailySlots: getSortedSlotsFromDaySchedules(range.daySchedules),
                    })),
                dateOverrides: form.dateOverrides
                    .filter((o) => o.date && validateDaySlots(o.slots))
                    .map((o) => ({
                        date: toLocalDayBoundaryIso(o.date, 'start'),
                        slots: [...o.slots].sort((a, b) => a.startTime.localeCompare(b.startTime)),
                    })),
                weekdays: primaryEnabledDays,
                dailySlots: sortedSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
                durationMinutes: Number(form.durationMinutes),
                beforeEventBufferMinutes: Number(form.beforeEventBufferMinutes),
                afterEventBufferMinutes: Number(form.afterEventBufferMinutes),
                reminderMinutesBefore: [...form.reminderMinutesBefore].sort((a, b) => a - b),
            },
        };
    }, [form]);

    return {
        form,
        errors,
        activeRangeIndex: safeActiveRangeIndex,
        setActiveRangeIndex,
        copiedRangeDaySchedules,
        copiedRangeLabel,
        workingHoursSummary,
        availableRangeDates,
        setFormField,
        toggleWeekday,
        setRangeValue,
        addRange,
        removeRange,
        toggleReminderOption,
        addCustomReminder,
        removeReminder,
        addDateOverride,
        removeDateOverride,
        setDateOverrideDate,
        setDateOverrideSlotTime,
        addDateOverrideSlot,
        removeDateOverrideSlot,
        setDaySlotTimeAtIndex,
        addDaySlot,
        removeDaySlot,
        copyDayScheduleFromRange,
        applyDayScheduleCopy,
        loadFromJob,
        buildSchedulingPayload,
        clearErrors,
    };
}
