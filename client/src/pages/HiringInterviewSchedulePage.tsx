import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    Copy,
    ExternalLink,
    Loader2,
    Plus,
    RefreshCw,
    Save,
    Trash2,
} from 'lucide-react';
import {
    useGetJobByIdQuery,
    useGetJobsQuery,
    useUpdateJobMutation,
} from '@/features/hiring/hiringApi';
import HiringInterviewTabs from '@/features/hiring/components/HiringInterviewTabs';

const WEEKDAY_OPTIONS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

const REMINDER_OPTIONS = [
    { label: '30 minutes before', value: 30 },
    { label: '2 hours before', value: 120 },
    { label: '1 day before', value: 1440 },
];

const REMINDER_UNITS = [
    { label: 'Minutes', value: 'minutes', multiplier: 1 },
    { label: 'Hours', value: 'hours', multiplier: 60 },
    { label: 'Days', value: 'days', multiplier: 1440 },
] as const;

type ReminderUnit = (typeof REMINDER_UNITS)[number]['value'];

function toLocalDateInput(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateForSummary(value?: string | Date) {
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

function formatWeekdaysForSummary(days?: number[]) {
    if (!Array.isArray(days) || days.length === 0) return '-';
    const labels = days
        .slice()
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_OPTIONS.find((item) => item.value === day)?.label)
        .filter(Boolean);

    return labels.length ? labels.join(', ') : '-';
}

function formatRangesForSummary(
    ranges?: Array<{ startDate?: string; endDate?: string }>
) {
    if (!Array.isArray(ranges) || ranges.length === 0) {
        return '-';
    }

    const labels = ranges
        .map((range) => {
            const start = formatDateForSummary(range.startDate);
            const end = formatDateForSummary(range.endDate);
            if (start === '-' || end === '-') {
                return '';
            }
            return `${start} to ${end}`;
        })
        .filter(Boolean);

    return labels.length ? labels.join(' | ') : '-';
}

function formatReminderLabel(minutes: number) {
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

function toLocalDayBoundaryIso(value: string, mode: 'start' | 'end'): string {
    if (!value) {
        return '';
    }

    const datePart = value.slice(0, 10);

    const boundary =
        mode === 'start'
            ? new Date(`${datePart}T00:00:00`)
            : new Date(`${datePart}T23:59:59.999`);

    if (Number.isNaN(boundary.getTime())) {
        return '';
    }

    return boundary.toISOString();
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
            >
                {label}
            </label>
            {children}
            {error && (
                <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
                    {error}
                </p>
            )}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

interface ScheduleFormState {
    enabled: boolean;
    timezone: string;
    organizerName: string;
    availableRanges: Array<{
        startDate: string;
        endDate: string;
    }>;
    dateOverrides: Array<{
        date: string;
        slots: Array<{ startTime: string; endTime: string }>;
    }>;
    daySchedules: Record<
        number,
        {
            enabled: boolean;
            slots: Array<{ startTime: string; endTime: string }>;
        }
    >;
    durationMinutes: number;
    beforeEventBufferMinutes: number;
    afterEventBufferMinutes: number;
    reminderMinutesBefore: number[];
    customReminderValue: string;
    customReminderUnit: ReminderUnit;
}

interface ScheduleErrors {
    schedule?: string;
}

const EMPTY_FORM: ScheduleFormState = {
    enabled: false,
    timezone: 'Asia/Kolkata',
    organizerName: 'HR Team',
    availableRanges: [{ startDate: '', endDate: '' }],
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

export default function HiringInterviewSchedulePage() {
    const [selectedJobId, setSelectedJobId] = useState('');
    const [form, setForm] = useState<ScheduleFormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<ScheduleErrors>({});
    const [serverError, setServerError] = useState('');
    const [savedMessage, setSavedMessage] = useState('');
    const [isForceSyncing, setIsForceSyncing] = useState(false);
    const [copyPanelDay, setCopyPanelDay] = useState<number | null>(null);
    const [copyTargets, setCopyTargets] = useState<number[]>([]);
    const copyPanelRef = useRef<HTMLDivElement | null>(null);

    const { data: jobsData, isLoading: isLoadingJobs } = useGetJobsQuery({ limit: 200 });
    const jobs = jobsData?.data.jobs || [];

    const {
        data: jobData,
        isFetching: isLoadingJob,
        refetch: refetchJob,
    } = useGetJobByIdQuery(selectedJobId, {
        skip: !selectedJobId,
    });
    const [updateJob, { isLoading: isSaving }] = useUpdateJobMutation();

    const enabledDays = useMemo(
        () =>
            WEEKDAY_OPTIONS.filter((day) => form.daySchedules[day.value]?.enabled).map(
                (day) => day.value
            ),
        [form.daySchedules]
    );

    const availableRangeDates = useMemo(() => {
        const dates: string[] = [];
        const seen = new Set<string>();

        form.availableRanges.forEach((range) => {
            if (!range.startDate || !range.endDate) {
                return;
            }

            const start = new Date(`${range.startDate}T00:00:00`);
            const end = new Date(`${range.endDate}T00:00:00`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
                return;
            }

            const cursor = new Date(start);
            while (cursor <= end) {
                const iso = cursor.toISOString().slice(0, 10);
                if (!seen.has(iso)) {
                    seen.add(iso);
                    dates.push(iso);
                }
                cursor.setDate(cursor.getDate() + 1);
            }
        });

        return dates.sort();
    }, [form.availableRanges]);

    const workingHoursSummary = useMemo(() => {
        const activeDays = WEEKDAY_OPTIONS.filter((day) => form.daySchedules[day.value]?.enabled);
        if (!activeDays.length) {
            return 'No active working days';
        }
        const first = activeDays[0].label;
        const last = activeDays[activeDays.length - 1].label;
        const firstSchedule = form.daySchedules[activeDays[0].value];
        const slotLabel = firstSchedule.slots
            .map((slot) => `${slot.startTime} - ${slot.endTime}`)
            .join(', ');
        return `${first}${activeDays.length > 1 ? ` - ${last}` : ''}, ${slotLabel}`;
    }, [form.daySchedules]);

    useEffect(() => {
        if (!selectedJobId && jobs.length > 0) {
            setSelectedJobId(jobs[0]._id);
        }
    }, [jobs, selectedJobId]);

    useEffect(() => {
        if (!jobData?.data.job) return;

        const scheduling = jobData.data.job.interviewScheduling;
        const defaultSlots =
            scheduling?.dailySlots?.length
                ? scheduling.dailySlots.map((slot) => ({
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                  }))
                : [{ startTime: '10:00', endTime: '18:00' }];
        const weekdays = scheduling?.weekdays?.length ? scheduling.weekdays : [1, 2, 3, 4, 5];
        const nextDaySchedules: ScheduleFormState['daySchedules'] = {
            0: { enabled: false, slots: defaultSlots.map((slot) => ({ ...slot })) },
            1: { enabled: false, slots: defaultSlots.map((slot) => ({ ...slot })) },
            2: { enabled: false, slots: defaultSlots.map((slot) => ({ ...slot })) },
            3: { enabled: false, slots: defaultSlots.map((slot) => ({ ...slot })) },
            4: { enabled: false, slots: defaultSlots.map((slot) => ({ ...slot })) },
            5: { enabled: false, slots: defaultSlots.map((slot) => ({ ...slot })) },
            6: { enabled: false, slots: defaultSlots.map((slot) => ({ ...slot })) },
        };

        weekdays.forEach((day) => {
            nextDaySchedules[day] = {
                enabled: true,
                slots: defaultSlots.map((slot) => ({ ...slot })),
            };
        });

        const availableRanges = Array.isArray(scheduling?.availableRanges)
            ? scheduling.availableRanges
                  .map((range) => ({
                      startDate: toLocalDateInput(range.startDate),
                      endDate: toLocalDateInput(range.endDate),
                  }))
                  .filter((range) => range.startDate || range.endDate)
            : [];

        const reminderMinutesBefore = Array.isArray(scheduling?.reminderMinutesBefore)
            ? scheduling.reminderMinutesBefore
            : typeof scheduling?.reminderMinutesBefore === 'number'
            ? [scheduling.reminderMinutesBefore]
            : [30];

        const dateOverrides = Array.isArray(scheduling?.dateOverrides)
            ? scheduling.dateOverrides
                  .map((override) => ({
                      date: toLocalDateInput(override.date),
                      slots: Array.isArray(override.slots) && override.slots.length
                          ? override.slots.map((slot) => ({
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                            }))
                          : [{ startTime: '10:00', endTime: '18:00' }],
                  }))
                  .filter((override) => override.date)
            : [];

        setForm({
            enabled: Boolean(scheduling?.enabled),
            timezone: scheduling?.timezone || 'Asia/Kolkata',
            organizerName: scheduling?.organizerName || 'HR Team',
            availableRanges: availableRanges.length ? availableRanges : [{ startDate: '', endDate: '' }],
            dateOverrides,
            daySchedules: nextDaySchedules,
            durationMinutes: scheduling?.durationMinutes || 45,
            beforeEventBufferMinutes: scheduling?.beforeEventBufferMinutes || 5,
            afterEventBufferMinutes: scheduling?.afterEventBufferMinutes || 5,
            reminderMinutesBefore,
            customReminderValue: '',
            customReminderUnit: 'minutes',
        });
        setErrors({});
        setServerError('');
    }, [jobData]);

    const selectedJob = jobData?.data.job;
    const isWorking = isSaving || isForceSyncing;
    const syncedSummary = useMemo(() => {
        const scheduling = selectedJob?.interviewScheduling;
        if (!scheduling) return null;

        const slotLabel = Array.isArray(scheduling.dailySlots) && scheduling.dailySlots.length
            ? scheduling.dailySlots
                  .map((slot) => `${slot.startTime} - ${slot.endTime}`)
                  .join(', ')
            : '-';
        return {
            timezone: scheduling.timezone || '-',
            weekdays: formatWeekdaysForSummary(scheduling.weekdays),
            hours: slotLabel,
            availableRanges: formatRangesForSummary(scheduling.availableRanges),
            dateOverridesCount: Array.isArray(scheduling.dateOverrides)
                ? scheduling.dateOverrides.length
                : 0,
            durationMinutes: scheduling.durationMinutes ?? '-',
            beforeEventBufferMinutes: scheduling.beforeEventBufferMinutes ?? '-',
            afterEventBufferMinutes: scheduling.afterEventBufferMinutes ?? '-',
            reminderMinutesBefore: Array.isArray(scheduling.reminderMinutesBefore)
                ? scheduling.reminderMinutesBefore.map((item) => formatReminderLabel(item)).join(', ')
                : '-',
            eventTypeId: scheduling.eventTypeId || '-',
            scheduleId: scheduling.scheduleId || '-',
        };
    }, [selectedJob]);

    const buildSchedulingPayload = () => {
        const sortedSlots = enabledDays.length
            ? [...form.daySchedules[enabledDays[0]].slots].sort((a, b) =>
                  a.startTime.localeCompare(b.startTime)
              )
            : [{ startTime: '10:00', endTime: '18:00' }];

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
                    })),
                dateOverrides: form.dateOverrides
                    .filter((override) => override.date && validateDaySlots(override.slots))
                    .map((override) => ({
                        date: toLocalDayBoundaryIso(override.date, 'start'),
                        slots: [...override.slots].sort((a, b) => a.startTime.localeCompare(b.startTime)),
                    })),
                weekdays: enabledDays,
                dailySlots: sortedSlots.map((slot) => ({
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                })),
                durationMinutes: Number(form.durationMinutes),
                beforeEventBufferMinutes: Number(form.beforeEventBufferMinutes),
                afterEventBufferMinutes: Number(form.afterEventBufferMinutes),
                reminderMinutesBefore: [...form.reminderMinutesBefore].sort((a, b) => a - b),
            },
        };
    };

    const set =
        (key: keyof ScheduleFormState) =>
        (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
        ) => {
            const value =
                e.target.type === 'checkbox'
                    ? (e.target as HTMLInputElement).checked
                    : e.target.type === 'number'
                    ? Number(e.target.value)
                    : e.target.value;

            setForm((prev) => ({ ...prev, [key]: value }));
            if (errors.schedule) {
                setErrors({});
            }
            if (savedMessage) {
                setSavedMessage('');
            }
        };

    const toggleWeekday = (day: number) => {
        setForm((prev) => ({
            ...prev,
            daySchedules: {
                ...prev.daySchedules,
                [day]: {
                    ...prev.daySchedules[day],
                    enabled: !prev.daySchedules[day].enabled,
                },
            },
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const setRangeValue = (
        index: number,
        field: 'startDate' | 'endDate',
        value: string
    ) => {
        setForm((prev) => ({
            ...prev,
            availableRanges: prev.availableRanges.map((range, idx) =>
                idx === index ? { ...range, [field]: value } : range
            ),
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const addRange = () => {
        setForm((prev) => ({
            ...prev,
            availableRanges: [...prev.availableRanges, { startDate: '', endDate: '' }],
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const removeRange = (index: number) => {
        setForm((prev) => {
            const next = prev.availableRanges.filter((_, idx) => idx !== index);
            return {
                ...prev,
                availableRanges: next.length ? next : [{ startDate: '', endDate: '' }],
            };
        });

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const toggleReminderOption = (minutes: number) => {
        setForm((prev) => {
            const exists = prev.reminderMinutesBefore.includes(minutes);
            const next = exists
                ? prev.reminderMinutesBefore.filter((value) => value !== minutes)
                : [...prev.reminderMinutesBefore, minutes];

            return {
                ...prev,
                reminderMinutesBefore: next.length ? next.sort((a, b) => a - b) : [],
            };
        });

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const addCustomReminder = () => {
        const parsed = Number(form.customReminderValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return;
        }

        const selectedUnit = REMINDER_UNITS.find((unit) => unit.value === form.customReminderUnit);
        const multiplier = selectedUnit?.multiplier ?? 1;
        const value = Math.floor(parsed) * multiplier;
        setForm((prev) => ({
            ...prev,
            reminderMinutesBefore: Array.from(new Set([...prev.reminderMinutesBefore, value])).sort(
                (a, b) => a - b
            ),
            customReminderValue: '',
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const removeReminder = (minutes: number) => {
        setForm((prev) => ({
            ...prev,
            reminderMinutesBefore: prev.reminderMinutesBefore.filter((value) => value !== minutes),
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const addDateOverride = () => {
        const defaultDate =
            availableRangeDates.find(
                (date) => !form.dateOverrides.some((override) => override.date === date)
            ) || availableRangeDates[0] || '';

        setForm((prev) => ({
            ...prev,
            dateOverrides: [
                ...prev.dateOverrides,
                {
                    date: defaultDate,
                    slots: [{ startTime: '10:00', endTime: '18:00' }],
                },
            ],
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const removeDateOverride = (index: number) => {
        setForm((prev) => ({
            ...prev,
            dateOverrides: prev.dateOverrides.filter((_, idx) => idx !== index),
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const setDateOverrideDate = (index: number, value: string) => {
        setForm((prev) => ({
            ...prev,
            dateOverrides: prev.dateOverrides.map((override, idx) =>
                idx === index ? { ...override, date: value } : override
            ),
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const setDateOverrideSlotTime = (
        overrideIndex: number,
        slotIndex: number,
        field: 'startTime' | 'endTime',
        value: string
    ) => {
        setForm((prev) => ({
            ...prev,
            dateOverrides: prev.dateOverrides.map((override, idx) => {
                if (idx !== overrideIndex) {
                    return override;
                }

                return {
                    ...override,
                    slots: override.slots.map((slot, slotIdx) =>
                        slotIdx === slotIndex ? { ...slot, [field]: value } : slot
                    ),
                };
            }),
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const addDateOverrideSlot = (overrideIndex: number) => {
        setForm((prev) => ({
            ...prev,
            dateOverrides: prev.dateOverrides.map((override, idx) => {
                if (idx !== overrideIndex) {
                    return override;
                }

                const last = override.slots[override.slots.length - 1] || {
                    startTime: '10:00',
                    endTime: '18:00',
                };

                return {
                    ...override,
                    slots: [...override.slots, { ...last }],
                };
            }),
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const removeDateOverrideSlot = (overrideIndex: number, slotIndex: number) => {
        setForm((prev) => ({
            ...prev,
            dateOverrides: prev.dateOverrides.map((override, idx) => {
                if (idx !== overrideIndex || override.slots.length <= 1) {
                    return override;
                }

                return {
                    ...override,
                    slots: override.slots.filter((_, slotIdx) => slotIdx !== slotIndex),
                };
            }),
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const setDaySlotTimeAtIndex = (
        day: number,
        slotIndex: number,
        field: 'startTime' | 'endTime',
        value: string
    ) => {
        setForm((prev) => ({
            ...prev,
            daySchedules: {
                ...prev.daySchedules,
                [day]: {
                    ...prev.daySchedules[day],
                    slots: prev.daySchedules[day].slots.map((slot, index) =>
                        index === slotIndex ? { ...slot, [field]: value } : slot
                    ),
                },
            },
        }));

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const addDaySlot = (day: number) => {
        setForm((prev) => {
            const daySlots = prev.daySchedules[day].slots;
            const lastSlot = daySlots[daySlots.length - 1] || { startTime: '10:00', endTime: '18:00' };

            return {
                ...prev,
                daySchedules: {
                    ...prev.daySchedules,
                    [day]: {
                        ...prev.daySchedules[day],
                        slots: [...daySlots, { ...lastSlot }],
                    },
                },
            };
        });

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const removeDaySlot = (day: number, slotIndex: number) => {
        setForm((prev) => {
            const daySlots = prev.daySchedules[day].slots;
            if (daySlots.length <= 1) {
                return prev;
            }

            return {
                ...prev,
                daySchedules: {
                    ...prev.daySchedules,
                    [day]: {
                        ...prev.daySchedules[day],
                        slots: daySlots.filter((_, index) => index !== slotIndex),
                    },
                },
            };
        });

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const openCopyPanel = (day: number) => {
        setCopyPanelDay(day);
        setCopyTargets([day]);
    };

    const toggleCopyTarget = (day: number) => {
        setCopyTargets((prev) =>
            prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]
        );
    };

    const toggleCopyAllTargets = () => {
        if (copyTargets.length === WEEKDAY_OPTIONS.length) {
            setCopyTargets([]);
            return;
        }

        setCopyTargets(WEEKDAY_OPTIONS.map((day) => day.value));
    };

    const applyCopyTargets = () => {
        if (copyPanelDay === null) {
            return;
        }

        const source = form.daySchedules[copyPanelDay];
        if (!source) {
            setCopyPanelDay(null);
            return;
        }

        setForm((prev) => {
            const next = { ...prev.daySchedules };
            copyTargets.forEach((day) => {
                next[day] = {
                    ...next[day],
                    slots: source.slots.map((slot) => ({ ...slot })),
                };
            });

            return {
                ...prev,
                daySchedules: next,
            };
        });

        setCopyPanelDay(null);
        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const closeCopyPanel = () => {
        setCopyPanelDay(null);
        setCopyTargets([]);
    };

    useEffect(() => {
        if (copyPanelDay === null) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (!copyPanelRef.current) {
                return;
            }

            const target = event.target as Node;
            if (!copyPanelRef.current.contains(target)) {
                closeCopyPanel();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [copyPanelDay]);

    const normalizeSlots = (slots: Array<{ startTime: string; endTime: string }>) =>
        slots
            .map((slot) => `${slot.startTime}-${slot.endTime}`)
            .sort()
            .join('|');

    const validateDaySlots = (slots: Array<{ startTime: string; endTime: string }>): boolean => {
        if (!slots.length) {
            return false;
        }

        const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
        for (let i = 0; i < sorted.length; i += 1) {
            const slot = sorted[i];
            if (!slot.startTime || !slot.endTime || slot.endTime <= slot.startTime) {
                return false;
            }

            if (i > 0) {
                const prev = sorted[i - 1];
                if (slot.startTime < prev.endTime) {
                    return false;
                }
            }
        }

        return true;
    };

    const validate = () => {
        const nextErrors: ScheduleErrors = {};

        if (form.enabled) {
            if (!enabledDays.length) {
                nextErrors.schedule = 'Select at least one available weekday.';
            } else {
                const firstDaySchedule = form.daySchedules[enabledDays[0]];
                const firstDaySlots = firstDaySchedule?.slots || [];

                if (!validateDaySlots(firstDaySlots)) {
                    nextErrors.schedule =
                        'Set valid non-overlapping time intervals (end must be later than start).';
                }

                const baseline = normalizeSlots(firstDaySlots);
                const hasMixedHours = enabledDays.some((day) => {
                    const currentSlots = form.daySchedules[day]?.slots || [];
                    return !validateDaySlots(currentSlots) || normalizeSlots(currentSlots) !== baseline;
                });

                if (!nextErrors.schedule && hasMixedHours) {
                    nextErrors.schedule =
                        'Current sync uses a common set of intervals for all enabled days. Use copy/apply so enabled days have matching intervals.';
                }
            }

            const filledRanges = form.availableRanges.filter(
                (range) => range.startDate || range.endDate
            );

            const hasInvalidRange = filledRanges.some(
                (range) =>
                    !range.startDate ||
                    !range.endDate ||
                    new Date(range.startDate).getTime() > new Date(range.endDate).getTime()
            );

            if (!nextErrors.schedule && hasInvalidRange) {
                nextErrors.schedule =
                    'Each date range must have start and end dates, and end date must be on or after start date.';
            }

            if (!nextErrors.schedule && form.reminderMinutesBefore.length === 0) {
                nextErrors.schedule = 'Select at least one reminder timing.';
            }

            const usedDates = new Set<string>();
            const hasInvalidOverride = form.dateOverrides.some((override) => {
                if (!override.date || !validateDaySlots(override.slots)) {
                    return true;
                }

                if (availableRangeDates.length > 0 && !availableRangeDates.includes(override.date)) {
                    return true;
                }

                if (usedDates.has(override.date)) {
                    return true;
                }

                usedDates.add(override.date);
                return false;
            });

            if (!nextErrors.schedule && hasInvalidOverride) {
                nextErrors.schedule =
                    'Each custom date must be unique, inside selected ranges, and have valid non-overlapping slots.';
            }
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSave = async () => {
        if (!selectedJobId) return;

        setServerError('');
        setSavedMessage('');

        if (!validate()) return;

        try {
            await updateJob({
                id: selectedJobId,
                data: buildSchedulingPayload(),
            }).unwrap();
            await refetchJob();
            setSavedMessage('Interview schedule saved and synced. Booking link now uses this latest config.');
        } catch (err: any) {
            setServerError(
                err?.data?.message || 'Could not update interview scheduling right now.'
            );
        }
    };

    const handleForceSync = async () => {
        if (!selectedJobId || !form.enabled) return;

        setServerError('');
        setSavedMessage('');

        if (!validate()) return;

        setIsForceSyncing(true);

        try {
            await updateJob({
                id: selectedJobId,
                data: buildSchedulingPayload(),
            }).unwrap();
            await refetchJob();
            setSavedMessage('Cal.com re-sync completed. Booking link now reflects the current schedule config.');
        } catch (err: any) {
            setServerError(
                err?.data?.message || 'Could not re-sync this job with Cal.com right now.'
            );
        } finally {
            setIsForceSyncing(false);
        }
    };

    if (isLoadingJobs) {
        return (
            <div
                className="flex items-center justify-center h-[calc(100vh-64px)]"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    <Loader2 size={18} className="animate-spin" />
                    Loading jobs...
                </div>
            </div>
        );
    }

    return (
        <div
            className="px-8 py-6 max-w-[1080px] mx-auto"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >
            <HiringInterviewTabs
                title="Interview Schedule (Cal.com)"
                description="Configure interview slot rules job-wise and sync them with Cal.com."
            />

            {jobs.length === 0 ? (
                <div
                    className="rounded-xl border px-6 py-10 text-center"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                >
                    <CalendarDays
                        size={28}
                        className="mx-auto mb-3"
                        style={{ color: 'var(--color-text-muted)' }}
                    />
                    <p
                        className="text-sm font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        No jobs available yet.
                    </p>
                    <p
                        className="text-sm mt-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Create a job posting first, then come here to configure its interview schedule.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div
                        className="rounded-xl p-6 border"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        <Field label="Job Posting">
                            <select
                                value={selectedJobId}
                                onChange={(e) => setSelectedJobId(e.target.value)}
                                className="px-3 py-2.5 text-sm rounded-lg border w-full max-w-[360px]"
                                style={inputStyle}
                            >
                                {jobs.map((job) => (
                                    <option key={job._id} value={job._id}>
                                        {job.title} - {job.department}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    {!selectedJobId || isLoadingJob ? (
                        <div
                            className="rounded-xl border px-6 py-10 text-center text-sm"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            <div className="inline-flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                Loading schedule...
                            </div>
                        </div>
                    ) : (
                        <>
                            {serverError && (
                                <div
                                    className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                                    style={{
                                        backgroundColor: 'var(--color-danger-soft)',
                                        color: 'var(--color-danger)',
                                        border: '1px solid var(--color-danger)',
                                    }}
                                >
                                    <AlertCircle size={15} />
                                    {serverError}
                                </div>
                            )}

                            <div
                                className="rounded-xl border p-6 space-y-5"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                            >
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <h2
                                            className="text-sm font-semibold"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {selectedJob?.title}
                                        </h2>
                                        <p
                                            className="text-xs mt-1"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            {selectedJob?.department} {selectedJob?.location ? `- ${selectedJob.location}` : ''}
                                        </p>
                                    </div>
                                    {selectedJob?.interviewScheduling?.bookingUrl && (
                                        <a
                                            href={selectedJob.interviewScheduling.bookingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs"
                                            style={{ color: 'var(--color-primary)' }}
                                        >
                                            Open Booking URL <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>

                                <div
                                    className="rounded-lg border p-4 text-xs"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-subtle)',
                                        color: 'var(--color-text-secondary)',
                                    }}
                                >
                                    <div className="flex flex-wrap gap-4">
                                        <span>
                                            Sync: <strong>{selectedJob?.interviewScheduling?.syncStatus || 'not_configured'}</strong>
                                        </span>
                                        <span>
                                            Active: <strong>{selectedJob?.interviewScheduling?.active ? 'yes' : 'no'}</strong>
                                        </span>
                                        <span>
                                            URL: <strong>{selectedJob?.interviewScheduling?.bookingUrl ? 'available' : 'missing'}</strong>
                                        </span>
                                        <span>
                                            Last synced:{' '}
                                            <strong>
                                                {selectedJob?.interviewScheduling?.lastSyncedAt
                                                    ? new Date(
                                                          selectedJob.interviewScheduling.lastSyncedAt
                                                      ).toLocaleString('en-IN')
                                                    : '-'}
                                            </strong>
                                        </span>
                                    </div>
                                    {selectedJob?.interviewScheduling?.syncError && (
                                        <p className="mt-2" style={{ color: 'var(--color-danger)' }}>
                                            Sync error: {selectedJob.interviewScheduling.syncError}
                                        </p>
                                    )}
                                </div>

                                <div
                                    className="rounded-lg border p-4"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: '#F8FFFB',
                                    }}
                                >
                                    <p
                                        className="text-xs font-semibold uppercase tracking-wide"
                                        style={{ color: '#166534' }}
                                    >
                                        Last Synced Config Summary
                                    </p>
                                    <p
                                        className="text-xs mt-1"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        Values below are from the currently saved job schedule that gets pushed to Cal.com.
                                    </p>

                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                        <p style={{ color: 'var(--color-text-secondary)' }}>
                                            Timezone: <strong style={{ color: 'var(--color-text-primary)' }}>{syncedSummary?.timezone || '-'}</strong>
                                        </p>
                                        <p style={{ color: 'var(--color-text-secondary)' }}>
                                            Weekdays: <strong style={{ color: 'var(--color-text-primary)' }}>{syncedSummary?.weekdays || '-'}</strong>
                                        </p>
                                        <p style={{ color: 'var(--color-text-secondary)' }}>
                                            Working Hours: <strong style={{ color: 'var(--color-text-primary)' }}>{syncedSummary?.hours || '-'}</strong>
                                        </p>
                                        <p style={{ color: 'var(--color-text-secondary)' }}>
                                            Date Ranges: <strong style={{ color: 'var(--color-text-primary)' }}>{syncedSummary?.availableRanges || '-'}</strong>
                                        </p>
                                        <p style={{ color: 'var(--color-text-secondary)' }}>
                                            Duration: <strong style={{ color: 'var(--color-text-primary)' }}>{syncedSummary?.durationMinutes || '-'} min</strong>
                                        </p>
                                        <p style={{ color: 'var(--color-text-secondary)' }}>
                                            Buffers: <strong style={{ color: 'var(--color-text-primary)' }}>{syncedSummary?.beforeEventBufferMinutes || '-'} min before / {syncedSummary?.afterEventBufferMinutes || '-'} min after</strong>
                                        </p>
                                        <p style={{ color: 'var(--color-text-secondary)' }}>
                                            Reminders: <strong style={{ color: 'var(--color-text-primary)' }}>{syncedSummary?.reminderMinutesBefore || '-'}</strong>
                                        </p>
                                        <p style={{ color: 'var(--color-text-secondary)' }}>
                                            Custom Date Overrides: <strong style={{ color: 'var(--color-text-primary)' }}>{syncedSummary?.dateOverridesCount || 0}</strong>
                                        </p>
                                        <p style={{ color: 'var(--color-text-secondary)' }}>
                                            Cal IDs: <strong style={{ color: 'var(--color-text-primary)' }}>schedule {syncedSummary?.scheduleId || '-'} / event {syncedSummary?.eventTypeId || '-'}</strong>
                                        </p>
                                    </div>
                                </div>

                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={form.enabled}
                                            onChange={set('enabled')}
                                            className="sr-only"
                                        />
                                        <div
                                            className="w-10 h-6 rounded-full transition-colors duration-200"
                                            style={{
                                                backgroundColor: form.enabled
                                                    ? 'var(--color-primary)'
                                                    : 'var(--color-border-default)',
                                            }}
                                        />
                                        <div
                                            className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                                            style={{
                                                transform: form.enabled
                                                    ? 'translateX(16px)'
                                                    : 'translateX(0)',
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <p
                                            className="text-sm font-medium"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            Enable interview scheduling
                                        </p>
                                        <p
                                            className="text-xs"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            Turn this on to sync job-specific interview availability to Cal.com.
                                        </p>
                                    </div>
                                </label>

                                {form.enabled && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Timezone">
                                                <select
                                                    value={form.timezone}
                                                    onChange={set('timezone')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                >
                                                    {[
                                                        'Asia/Kolkata',
                                                        'Asia/Dubai',
                                                        'Europe/London',
                                                        'Europe/Berlin',
                                                        'America/New_York',
                                                        'America/Los_Angeles',
                                                        'Australia/Sydney',
                                                    ].map((timezone) => (
                                                        <option key={timezone} value={timezone}>
                                                            {timezone}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Field>
                                            <Field label="Organizer">
                                                <input
                                                    type="text"
                                                    value={form.organizerName}
                                                    onChange={set('organizerName')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                        </div>

                                        <div
                                            className="rounded-lg border p-4"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                backgroundColor: 'var(--color-bg-subtle)',
                                            }}
                                        >
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <p
                                                    className="text-sm font-medium"
                                                    style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                    Available Date Ranges
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={addRange}
                                                    className="px-2.5 py-1.5 rounded-md text-xs inline-flex items-center gap-1"
                                                    style={{
                                                        backgroundColor: 'var(--color-primary)',
                                                        color: '#fff',
                                                    }}
                                                >
                                                    <Plus size={12} /> Add range
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {form.availableRanges.map((range, index) => (
                                                    <div key={`range-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                                        <input
                                                            type="date"
                                                            value={range.startDate}
                                                            onChange={(e) =>
                                                                setRangeValue(index, 'startDate', e.target.value)
                                                            }
                                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                            style={inputStyle}
                                                        />
                                                        <input
                                                            type="date"
                                                            value={range.endDate}
                                                            onChange={(e) =>
                                                                setRangeValue(index, 'endDate', e.target.value)
                                                            }
                                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                            style={inputStyle}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRange(index)}
                                                            className="w-8 h-8 rounded-lg border inline-flex items-center justify-center"
                                                            style={{
                                                                borderColor: 'var(--color-border-default)',
                                                                color: 'var(--color-text-secondary)',
                                                                backgroundColor: 'var(--color-bg-surface)',
                                                            }}
                                                            title="Remove range"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <Field label="Interview Duration (minutes)">
                                                <input
                                                    type="number"
                                                    min={10}
                                                    max={240}
                                                    value={form.durationMinutes}
                                                    onChange={set('durationMinutes')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                            <Field label="Buffer Before Event (minutes)">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={120}
                                                    value={form.beforeEventBufferMinutes}
                                                    onChange={set('beforeEventBufferMinutes')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                            <Field label="Buffer After Event (minutes)">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={120}
                                                    value={form.afterEventBufferMinutes}
                                                    onChange={set('afterEventBufferMinutes')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                        </div>

                                        <div
                                            className="rounded-lg border p-4"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                backgroundColor: 'var(--color-bg-subtle)',
                                            }}
                                        >
                                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                Reminder Email Timings
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-3">
                                                {REMINDER_OPTIONS.map((option) => (
                                                    <label
                                                        key={option.value}
                                                        className="inline-flex items-center gap-2 text-sm"
                                                        style={{ color: 'var(--color-text-primary)' }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={form.reminderMinutesBefore.includes(option.value)}
                                                            onChange={() => toggleReminderOption(option.value)}
                                                        />
                                                        {option.label}
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="mt-3 flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={10080}
                                                    value={form.customReminderValue}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            customReminderValue: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="Custom value"
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-[130px]"
                                                    style={inputStyle}
                                                />
                                                <select
                                                    value={form.customReminderUnit}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            customReminderUnit: e.target.value as ReminderUnit,
                                                        }))
                                                    }
                                                    className="px-3 py-2.5 text-sm rounded-lg border"
                                                    style={inputStyle}
                                                >
                                                    {REMINDER_UNITS.map((unit) => (
                                                        <option key={unit.value} value={unit.value}>
                                                            {unit.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={addCustomReminder}
                                                    className="px-2.5 py-2 rounded-md text-xs"
                                                    style={{
                                                        backgroundColor: 'var(--color-primary)',
                                                        color: '#fff',
                                                    }}
                                                >
                                                    Add timing
                                                </button>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {form.reminderMinutesBefore.map((minutes) => (
                                                    <span
                                                        key={minutes}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                                                        style={{
                                                            backgroundColor: 'var(--color-bg-surface)',
                                                            border: '1px solid var(--color-border-default)',
                                                            color: 'var(--color-text-primary)',
                                                        }}
                                                    >
                                                            {formatReminderLabel(minutes)}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeReminder(minutes)}
                                                            className="inline-flex items-center"
                                                            style={{ color: 'var(--color-text-muted)' }}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <p
                                            className="text-xs"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            Copy and + interval changes affect the generated booking link after Save or Force Re-sync.
                                        </p>

                                        <div
                                            className="rounded-xl border p-4"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                backgroundColor: '#FAFAFA',
                                            }}
                                        >
                                            <p
                                                className="text-sm font-semibold"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                Working hours
                                            </p>
                                            <p
                                                className="text-xs mt-1 mb-4"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                {workingHoursSummary}
                                            </p>

                                            <div className="space-y-3">
                                                {WEEKDAY_OPTIONS.map((day) => {
                                                    const dayState = form.daySchedules[day.value];
                                                    return (
                                                        <div
                                                            key={day.value}
                                                            className="grid grid-cols-[130px_1fr] md:grid-cols-[160px_1fr] items-start gap-4"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleWeekday(day.value)}
                                                                className="inline-flex items-center gap-2 text-sm font-medium"
                                                                style={{
                                                                    color: dayState.enabled
                                                                        ? 'var(--color-text-primary)'
                                                                        : 'var(--color-text-muted)',
                                                                }}
                                                            >
                                                                <span
                                                                    className="relative inline-block w-10 h-6 rounded-full"
                                                                    style={{
                                                                        backgroundColor: dayState.enabled
                                                                            ? 'var(--color-primary)'
                                                                            : 'var(--color-border-default)',
                                                                    }}
                                                                >
                                                                    <span
                                                                        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                                                                        style={{
                                                                            transform: dayState.enabled
                                                                                ? 'translateX(16px)'
                                                                                : 'translateX(0)',
                                                                        }}
                                                                    />
                                                                </span>
                                                                {day.label === 'Sun'
                                                                    ? 'Sunday'
                                                                    : day.label === 'Mon'
                                                                    ? 'Monday'
                                                                    : day.label === 'Tue'
                                                                    ? 'Tuesday'
                                                                    : day.label === 'Wed'
                                                                    ? 'Wednesday'
                                                                    : day.label === 'Thu'
                                                                    ? 'Thursday'
                                                                    : day.label === 'Fri'
                                                                    ? 'Friday'
                                                                    : 'Saturday'}
                                                            </button>

                                                            <div className="space-y-2">
                                                                {dayState.slots.map((slot, slotIndex) => (
                                                                    <div key={`${day.value}-${slotIndex}`} className="flex items-center gap-2 relative">
                                                                        <input
                                                                            type="time"
                                                                            value={slot.startTime}
                                                                            onChange={(e) =>
                                                                                setDaySlotTimeAtIndex(
                                                                                    day.value,
                                                                                    slotIndex,
                                                                                    'startTime',
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            disabled={!dayState.enabled}
                                                                            className="px-3 py-2 text-sm rounded-lg border"
                                                                            style={{
                                                                                ...inputStyle,
                                                                                width: '150px',
                                                                                opacity: dayState.enabled ? 1 : 0.6,
                                                                            }}
                                                                        />
                                                                        <span style={{ color: 'var(--color-text-muted)' }}>
                                                                            -
                                                                        </span>
                                                                        <input
                                                                            type="time"
                                                                            value={slot.endTime}
                                                                            onChange={(e) =>
                                                                                setDaySlotTimeAtIndex(
                                                                                    day.value,
                                                                                    slotIndex,
                                                                                    'endTime',
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            disabled={!dayState.enabled}
                                                                            className="px-3 py-2 text-sm rounded-lg border"
                                                                            style={{
                                                                                ...inputStyle,
                                                                                width: '150px',
                                                                                opacity: dayState.enabled ? 1 : 0.6,
                                                                            }}
                                                                        />

                                                                        {slotIndex === 0 ? (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => addDaySlot(day.value)}
                                                                                    title="Add interval"
                                                                                    className="w-8 h-8 rounded-lg border inline-flex items-center justify-center transition-colors"
                                                                                    style={{
                                                                                        borderColor: 'var(--color-border-default)',
                                                                                        color: 'var(--color-text-secondary)',
                                                                                        opacity: dayState.enabled ? 1 : 0.5,
                                                                                        backgroundColor: 'var(--color-bg-surface)',
                                                                                    }}
                                                                                    disabled={!dayState.enabled}
                                                                                >
                                                                                    <Plus size={14} />
                                                                                </button>
                                                                                <div className="relative">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => openCopyPanel(day.value)}
                                                                                        title="Copy times to selected days"
                                                                                        className="w-8 h-8 rounded-lg border inline-flex items-center justify-center transition-colors"
                                                                                        style={{
                                                                                            borderColor:
                                                                                                copyPanelDay === day.value
                                                                                                    ? 'var(--color-primary)'
                                                                                                    : 'var(--color-border-default)',
                                                                                            color: 'var(--color-text-secondary)',
                                                                                            opacity: dayState.enabled ? 1 : 0.5,
                                                                                            backgroundColor:
                                                                                                copyPanelDay === day.value
                                                                                                    ? 'var(--color-primary-soft)'
                                                                                                    : 'var(--color-bg-surface)',
                                                                                        }}
                                                                                        disabled={!dayState.enabled}
                                                                                    >
                                                                                        <Copy size={14} />
                                                                                    </button>

                                                                                    {copyPanelDay === day.value && dayState.enabled && (
                                                                                        <div
                                                                                            ref={copyPanelRef}
                                                                                            className="absolute z-30 top-full mt-2 right-0 w-[270px] rounded-lg border p-3 shadow-md"
                                                                                            style={{
                                                                                                borderColor: 'var(--color-border-default)',
                                                                                                backgroundColor: 'var(--color-bg-surface)',
                                                                                            }}
                                                                                        >
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                                                                                                Copy Times To
                                                                                            </p>
                                                                                            <label className="mt-2 flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-primary)' }}>
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    checked={copyTargets.length === WEEKDAY_OPTIONS.length}
                                                                                                    onChange={toggleCopyAllTargets}
                                                                                                />
                                                                                                Select all
                                                                                            </label>
                                                                                            <div className="mt-2 space-y-1 max-h-[180px] overflow-y-auto pr-1">
                                                                                                {WEEKDAY_OPTIONS.map((target) => (
                                                                                                    <label key={target.value} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-primary)' }}>
                                                                                                        <input
                                                                                                            type="checkbox"
                                                                                                            checked={copyTargets.includes(target.value)}
                                                                                                            onChange={() => toggleCopyTarget(target.value)}
                                                                                                        />
                                                                                                        {target.label}
                                                                                                    </label>
                                                                                                ))}
                                                                                            </div>
                                                                                            <div className="mt-3 flex items-center justify-end gap-2">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={closeCopyPanel}
                                                                                                    className="px-2.5 py-1.5 rounded-md text-xs border"
                                                                                                    style={{
                                                                                                        borderColor: 'var(--color-border-default)',
                                                                                                        color: 'var(--color-text-secondary)',
                                                                                                    }}
                                                                                                >
                                                                                                    Cancel
                                                                                                </button>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={applyCopyTargets}
                                                                                                    className="px-2.5 py-1.5 rounded-md text-xs"
                                                                                                    style={{
                                                                                                        backgroundColor: 'var(--color-primary)',
                                                                                                        color: '#fff',
                                                                                                    }}
                                                                                                >
                                                                                                    Apply
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeDaySlot(day.value, slotIndex)}
                                                                                title="Remove interval"
                                                                                className="w-8 h-8 rounded-lg border inline-flex items-center justify-center transition-colors"
                                                                                style={{
                                                                                    borderColor: 'var(--color-border-default)',
                                                                                    color: 'var(--color-text-secondary)',
                                                                                    opacity: dayState.enabled ? 1 : 0.5,
                                                                                    backgroundColor: 'var(--color-bg-surface)',
                                                                                }}
                                                                                disabled={!dayState.enabled || dayState.slots.length <= 1}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div
                                            className="rounded-xl border p-4"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                backgroundColor: '#F9FBFF',
                                            }}
                                        >
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <div>
                                                    <p
                                                        className="text-sm font-semibold"
                                                        style={{ color: 'var(--color-text-primary)' }}
                                                    >
                                                        Date-Specific Availability Overrides
                                                    </p>
                                                    <p
                                                        className="text-xs mt-1"
                                                        style={{ color: 'var(--color-text-secondary)' }}
                                                    >
                                                        Pick dates from selected ranges and set custom slots for those dates only.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={addDateOverride}
                                                    disabled={availableRangeDates.length === 0}
                                                    className="px-2.5 py-1.5 rounded-md text-xs inline-flex items-center gap-1"
                                                    style={{
                                                        backgroundColor: 'var(--color-primary)',
                                                        color: '#fff',
                                                        opacity: availableRangeDates.length === 0 ? 0.6 : 1,
                                                    }}
                                                >
                                                    <Plus size={12} /> Add custom date
                                                </button>
                                            </div>

                                            {availableRangeDates.length === 0 ? (
                                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    Add valid Available Date Ranges first to enable date-specific changes.
                                                </p>
                                            ) : form.dateOverrides.length === 0 ? (
                                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    No custom dates yet. Use Add custom date to set exceptions such as breaks or different hours.
                                                </p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {form.dateOverrides.map((override, overrideIndex) => (
                                                        <div
                                                            key={`override-${overrideIndex}`}
                                                            className="rounded-lg border p-3"
                                                            style={{
                                                                borderColor: 'var(--color-border-default)',
                                                                backgroundColor: 'var(--color-bg-surface)',
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <select
                                                                    value={override.date}
                                                                    onChange={(e) =>
                                                                        setDateOverrideDate(overrideIndex, e.target.value)
                                                                    }
                                                                    className="px-3 py-2 text-sm rounded-lg border"
                                                                    style={inputStyle}
                                                                >
                                                                    <option value="">Select date</option>
                                                                    {availableRangeDates.map((date) => (
                                                                        <option key={date} value={date}>
                                                                            {new Date(`${date}T00:00:00`).toLocaleDateString(
                                                                                'en-IN',
                                                                                {
                                                                                    weekday: 'short',
                                                                                    day: '2-digit',
                                                                                    month: 'short',
                                                                                    year: 'numeric',
                                                                                }
                                                                            )}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => addDateOverrideSlot(overrideIndex)}
                                                                    className="w-8 h-8 rounded-lg border inline-flex items-center justify-center"
                                                                    style={{
                                                                        borderColor: 'var(--color-border-default)',
                                                                        color: 'var(--color-text-secondary)',
                                                                        backgroundColor: 'var(--color-bg-surface)',
                                                                    }}
                                                                    title="Add interval"
                                                                >
                                                                    <Plus size={14} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeDateOverride(overrideIndex)}
                                                                    className="w-8 h-8 rounded-lg border inline-flex items-center justify-center"
                                                                    style={{
                                                                        borderColor: 'var(--color-border-default)',
                                                                        color: 'var(--color-text-secondary)',
                                                                        backgroundColor: 'var(--color-bg-surface)',
                                                                    }}
                                                                    title="Remove custom date"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {override.slots.map((slot, slotIndex) => (
                                                                    <div
                                                                        key={`override-${overrideIndex}-slot-${slotIndex}`}
                                                                        className="flex items-center gap-2"
                                                                    >
                                                                        <input
                                                                            type="time"
                                                                            value={slot.startTime}
                                                                            onChange={(e) =>
                                                                                setDateOverrideSlotTime(
                                                                                    overrideIndex,
                                                                                    slotIndex,
                                                                                    'startTime',
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            className="px-3 py-2 text-sm rounded-lg border"
                                                                            style={{ ...inputStyle, width: '150px' }}
                                                                        />
                                                                        <span style={{ color: 'var(--color-text-muted)' }}>
                                                                            -
                                                                        </span>
                                                                        <input
                                                                            type="time"
                                                                            value={slot.endTime}
                                                                            onChange={(e) =>
                                                                                setDateOverrideSlotTime(
                                                                                    overrideIndex,
                                                                                    slotIndex,
                                                                                    'endTime',
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            className="px-3 py-2 text-sm rounded-lg border"
                                                                            style={{ ...inputStyle, width: '150px' }}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                removeDateOverrideSlot(
                                                                                    overrideIndex,
                                                                                    slotIndex
                                                                                )
                                                                            }
                                                                            className="w-8 h-8 rounded-lg border inline-flex items-center justify-center"
                                                                            style={{
                                                                                borderColor: 'var(--color-border-default)',
                                                                                color: 'var(--color-text-secondary)',
                                                                                backgroundColor: 'var(--color-bg-surface)',
                                                                            }}
                                                                            title="Remove interval"
                                                                            disabled={override.slots.length <= 1}
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {errors.schedule && (
                                            <div
                                                className="rounded-lg px-4 py-3 text-sm"
                                                style={{
                                                    backgroundColor: 'var(--color-danger-soft)',
                                                    color: 'var(--color-danger)',
                                                    border: '1px solid var(--color-danger)',
                                                }}
                                            >
                                                {errors.schedule}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
                                    <p
                                        className="text-xs"
                                        style={{
                                            color: savedMessage
                                                ? '#166534'
                                                : 'var(--color-text-muted)',
                                        }}
                                    >
                                        {savedMessage ||
                                            'Saving here updates the selected job and re-syncs its Cal.com settings.'}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handleForceSync}
                                            disabled={!form.enabled || isWorking}
                                            className="px-4 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 border"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                backgroundColor: 'var(--color-bg-surface)',
                                                color: form.enabled
                                                    ? 'var(--color-text-primary)'
                                                    : 'var(--color-text-muted)',
                                                opacity: !form.enabled || isWorking ? 0.7 : 1,
                                            }}
                                        >
                                            {isForceSyncing ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <RefreshCw size={16} />
                                            )}
                                            Force Re-sync with Cal.com
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={isWorking}
                                            className="px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                                            style={{
                                                backgroundColor: 'var(--color-primary)',
                                                color: '#fff',
                                                opacity: isWorking ? 0.7 : 1,
                                            }}
                                        >
                                            {isSaving ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Save size={16} />
                                            )}
                                            Save Schedule
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
