import { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, ExternalLink, Loader2, RefreshCw, Save } from 'lucide-react';
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

function toLocalDateTimeInput(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}`;
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
    availableFrom: string;
    availableTo: string;
    weekdays: number[];
    slotStart: string;
    slotEnd: string;
    durationMinutes: number;
    slotIntervalMinutes: number;
    minimumBookingNoticeMinutes: number;
    beforeEventBufferMinutes: number;
    afterEventBufferMinutes: number;
}

interface ScheduleErrors {
    schedule?: string;
}

const EMPTY_FORM: ScheduleFormState = {
    enabled: false,
    timezone: 'Asia/Kolkata',
    organizerName: 'HR Team',
    availableFrom: '',
    availableTo: '',
    weekdays: [1, 2, 3, 4, 5],
    slotStart: '10:00',
    slotEnd: '18:00',
    durationMinutes: 45,
    slotIntervalMinutes: 30,
    minimumBookingNoticeMinutes: 60,
    beforeEventBufferMinutes: 5,
    afterEventBufferMinutes: 5,
};

export default function HiringInterviewSchedulePage() {
    const [selectedJobId, setSelectedJobId] = useState('');
    const [form, setForm] = useState<ScheduleFormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<ScheduleErrors>({});
    const [serverError, setServerError] = useState('');
    const [savedMessage, setSavedMessage] = useState('');
    const [isForceSyncing, setIsForceSyncing] = useState(false);

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

    useEffect(() => {
        if (!selectedJobId && jobs.length > 0) {
            setSelectedJobId(jobs[0]._id);
        }
    }, [jobs, selectedJobId]);

    useEffect(() => {
        if (!jobData?.data.job) return;

        const scheduling = jobData.data.job.interviewScheduling;
        setForm({
            enabled: Boolean(scheduling?.enabled),
            timezone: scheduling?.timezone || 'Asia/Kolkata',
            organizerName: scheduling?.organizerName || 'HR Team',
            availableFrom: toLocalDateTimeInput(scheduling?.availableFrom),
            availableTo: toLocalDateTimeInput(scheduling?.availableTo),
            weekdays: scheduling?.weekdays?.length ? scheduling.weekdays : [1, 2, 3, 4, 5],
            slotStart: scheduling?.dailySlots?.[0]?.startTime || '10:00',
            slotEnd: scheduling?.dailySlots?.[0]?.endTime || '18:00',
            durationMinutes: scheduling?.durationMinutes || 45,
            slotIntervalMinutes: scheduling?.slotIntervalMinutes || 30,
            minimumBookingNoticeMinutes:
                scheduling?.minimumBookingNoticeMinutes || 60,
            beforeEventBufferMinutes: scheduling?.beforeEventBufferMinutes || 5,
            afterEventBufferMinutes: scheduling?.afterEventBufferMinutes || 5,
        });
        setErrors({});
        setServerError('');
    }, [jobData]);

    const selectedJob = jobData?.data.job;
    const isWorking = isSaving || isForceSyncing;

    const buildSchedulingPayload = () => ({
        interviewScheduling: {
            enabled: form.enabled,
            active: form.enabled,
            timezone: form.timezone,
            organizerName: form.organizerName,
            availableFrom: form.availableFrom
                ? new Date(form.availableFrom).toISOString()
                : null,
            availableTo: form.availableTo
                ? new Date(form.availableTo).toISOString()
                : null,
            weekdays: form.weekdays,
            dailySlots: [
                {
                    startTime: form.slotStart,
                    endTime: form.slotEnd,
                },
            ],
            durationMinutes: Number(form.durationMinutes),
            slotIntervalMinutes: Number(form.slotIntervalMinutes),
            minimumBookingNoticeMinutes: Number(form.minimumBookingNoticeMinutes),
            beforeEventBufferMinutes: Number(form.beforeEventBufferMinutes),
            afterEventBufferMinutes: Number(form.afterEventBufferMinutes),
        },
    });

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
        setForm((prev) => {
            const weekdays = prev.weekdays.includes(day)
                ? prev.weekdays.filter((value) => value !== day)
                : [...prev.weekdays, day].sort((a, b) => a - b);

            return { ...prev, weekdays };
        });

        if (errors.schedule) {
            setErrors({});
        }
        if (savedMessage) {
            setSavedMessage('');
        }
    };

    const validate = () => {
        const nextErrors: ScheduleErrors = {};

        if (form.enabled) {
            if (!form.weekdays.length) {
                nextErrors.schedule = 'Select at least one available weekday.';
            } else if (!form.slotStart || !form.slotEnd) {
                nextErrors.schedule = 'Set a valid daily slot range.';
            } else if (form.slotEnd <= form.slotStart) {
                nextErrors.schedule = 'Daily slot end time must be later than the start time.';
            } else if (
                form.availableFrom &&
                form.availableTo &&
                new Date(form.availableFrom).getTime() >
                    new Date(form.availableTo).getTime()
            ) {
                nextErrors.schedule = 'Availability end must be later than start.';
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
            setSavedMessage('Interview schedule saved successfully.');
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
            setSavedMessage('Cal.com re-sync completed successfully.');
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
                                                <input
                                                    type="text"
                                                    value={form.timezone}
                                                    onChange={set('timezone')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
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

                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Available From">
                                                <input
                                                    type="datetime-local"
                                                    value={form.availableFrom}
                                                    onChange={set('availableFrom')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                            <Field label="Available To">
                                                <input
                                                    type="datetime-local"
                                                    value={form.availableTo}
                                                    onChange={set('availableTo')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                        </div>

                                        <div>
                                            <p
                                                className="text-xs font-medium mb-2"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                Available Weekdays
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {WEEKDAY_OPTIONS.map((day) => {
                                                    const active = form.weekdays.includes(day.value);
                                                    return (
                                                        <button
                                                            key={day.value}
                                                            type="button"
                                                            onClick={() => toggleWeekday(day.value)}
                                                            className="px-3 py-2 rounded-lg text-xs border transition-colors"
                                                            style={{
                                                                borderColor: active
                                                                    ? 'var(--color-primary)'
                                                                    : 'var(--color-border-default)',
                                                                backgroundColor: active
                                                                    ? 'var(--color-primary-soft)'
                                                                    : 'var(--color-bg-surface)',
                                                                color: active
                                                                    ? 'var(--color-primary-dark)'
                                                                    : 'var(--color-text-secondary)',
                                                            }}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Daily Slot Start">
                                                <input
                                                    type="time"
                                                    value={form.slotStart}
                                                    onChange={set('slotStart')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                            <Field label="Daily Slot End">
                                                <input
                                                    type="time"
                                                    value={form.slotEnd}
                                                    onChange={set('slotEnd')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <Field label="Duration (mins)">
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
                                            <Field label="Slot Interval (mins)">
                                                <input
                                                    type="number"
                                                    min={5}
                                                    max={180}
                                                    value={form.slotIntervalMinutes}
                                                    onChange={set('slotIntervalMinutes')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                            <Field label="Booking Notice (mins)">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={43200}
                                                    value={form.minimumBookingNoticeMinutes}
                                                    onChange={set('minimumBookingNoticeMinutes')}
                                                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                                    style={inputStyle}
                                                />
                                            </Field>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Before Event Buffer (mins)">
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
                                            <Field label="After Event Buffer (mins)">
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
