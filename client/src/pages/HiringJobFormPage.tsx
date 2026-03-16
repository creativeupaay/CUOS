import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ChevronLeft, AlertCircle } from 'lucide-react';
import {
    useCreateJobMutation,
    useUpdateJobMutation,
    useGetJobByIdQuery,
} from '@/features/hiring/hiringApi';
import type { EmploymentType } from '@/features/hiring/types/types';

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
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// ── Field component ───────────────────────────────────────
function Field({
    label,
    required,
    error,
    children,
}: {
    label: string;
    required?: boolean;
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
                {required && (
                    <span style={{ color: 'var(--color-danger)' }}> *</span>
                )}
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

// ── Input styles ──────────────────────────────────────────
const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

// ── Form state ────────────────────────────────────────────
interface FormState {
    title: string;
    department: string;
    location: string;
    description: string;
    requirements: string;
    employmentType: EmploymentType;
    isHiring: boolean;
    assignmentRequired: boolean;
    interviewSchedulingEnabled: boolean;
    interviewSchedulingActive: boolean;
    interviewTimezone: string;
    interviewOrganizerName: string;
    interviewAvailableFrom: string;
    interviewAvailableTo: string;
    interviewWeekdays: number[];
    interviewSlotStart: string;
    interviewSlotEnd: string;
    interviewDurationMinutes: number;
    interviewSlotIntervalMinutes: number;
    interviewMinimumBookingNoticeMinutes: number;
    interviewBeforeEventBufferMinutes: number;
    interviewAfterEventBufferMinutes: number;
}

interface FormErrors {
    title?: string;
    department?: string;
    location?: string;
    description?: string;
    requirements?: string;
    interviewScheduling?: string;
}

const EMPTY_FORM: FormState = {
    title: '',
    department: '',
    location: '',
    description: '',
    requirements: '',
    employmentType: 'full-time',
    isHiring: false,
    assignmentRequired: false,
    interviewSchedulingEnabled: false,
    interviewSchedulingActive: false,
    interviewTimezone: 'Asia/Kolkata',
    interviewOrganizerName: 'HR Team',
    interviewAvailableFrom: '',
    interviewAvailableTo: '',
    interviewWeekdays: [1, 2, 3, 4, 5],
    interviewSlotStart: '10:00',
    interviewSlotEnd: '18:00',
    interviewDurationMinutes: 45,
    interviewSlotIntervalMinutes: 30,
    interviewMinimumBookingNoticeMinutes: 60,
    interviewBeforeEventBufferMinutes: 5,
    interviewAfterEventBufferMinutes: 5,
};

// ── Component ─────────────────────────────────────────────
export default function HiringJobFormPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);

    const { data: jobData, isLoading: isLoadingJob } = useGetJobByIdQuery(
        id ?? '',
        { skip: !isEdit }
    );

    const [createJob, { isLoading: isCreating }] = useCreateJobMutation();
    const [updateJob, { isLoading: isUpdating }] = useUpdateJobMutation();
    const isSubmitting = isCreating || isUpdating;

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [serverError, setServerError] = useState('');

    // Populate form when editing
    useEffect(() => {
        if (isEdit && jobData?.data.job) {
            const j = jobData.data.job;
            const scheduling = j.interviewScheduling;
            setForm({
                title: j.title,
                department: j.department,
                location: j.location,
                description: j.description,
                requirements: j.requirements,
                employmentType: j.employmentType,
                isHiring: j.isHiring,
                assignmentRequired: j.assignmentRequired,
                interviewSchedulingEnabled: Boolean(scheduling?.enabled),
                interviewSchedulingActive: Boolean(scheduling?.active),
                interviewTimezone: scheduling?.timezone || 'Asia/Kolkata',
                interviewOrganizerName: scheduling?.organizerName || 'HR Team',
                interviewAvailableFrom: toLocalDateTimeInput(scheduling?.availableFrom),
                interviewAvailableTo: toLocalDateTimeInput(scheduling?.availableTo),
                interviewWeekdays: scheduling?.weekdays?.length
                    ? scheduling.weekdays
                    : [1, 2, 3, 4, 5],
                interviewSlotStart: scheduling?.dailySlots?.[0]?.startTime || '10:00',
                interviewSlotEnd: scheduling?.dailySlots?.[0]?.endTime || '18:00',
                interviewDurationMinutes: scheduling?.durationMinutes || 45,
                interviewSlotIntervalMinutes: scheduling?.slotIntervalMinutes || 30,
                interviewMinimumBookingNoticeMinutes:
                    scheduling?.minimumBookingNoticeMinutes || 60,
                interviewBeforeEventBufferMinutes:
                    scheduling?.beforeEventBufferMinutes || 5,
                interviewAfterEventBufferMinutes:
                    scheduling?.afterEventBufferMinutes || 5,
            });
        }
    }, [isEdit, jobData]);

    const set = (key: keyof FormState) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const value =
            e.target.type === 'checkbox'
                ? (e.target as HTMLInputElement).checked
                : e.target.value;
        setForm((prev) => {
            if (key === 'interviewSchedulingEnabled') {
                const enabled = Boolean(value);
                return {
                    ...prev,
                    interviewSchedulingEnabled: enabled,
                    interviewSchedulingActive: enabled,
                };
            }

            return { ...prev, [key]: value };
        });
        if (errors[key as keyof FormErrors]) {
            setErrors((prev) => ({ ...prev, [key]: undefined }));
        }
    };

    const validate = (): boolean => {
        const e: FormErrors = {};
        if (!form.title.trim()) e.title = 'Job title is required';
        if (!form.department.trim()) e.department = 'Department is required';
        if (!form.location.trim()) e.location = 'Location is required';
        if (!form.description.trim()) e.description = 'Description is required';
        if (!form.requirements.trim()) e.requirements = 'Requirements are required';

        if (form.interviewSchedulingEnabled) {
            if (!form.interviewWeekdays.length) {
                e.interviewScheduling = 'Select at least one available weekday';
            } else if (!form.interviewSlotStart || !form.interviewSlotEnd) {
                e.interviewScheduling = 'Set a valid daily slot range';
            } else if (form.interviewSlotEnd <= form.interviewSlotStart) {
                e.interviewScheduling = 'Daily slot end time must be later than start time';
            } else if (
                form.interviewAvailableFrom &&
                form.interviewAvailableTo &&
                new Date(form.interviewAvailableFrom).getTime() >
                    new Date(form.interviewAvailableTo).getTime()
            ) {
                e.interviewScheduling = 'Availability end must be later than start';
            }
        }

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError('');
        if (!validate()) return;

        const payload = {
            title: form.title,
            department: form.department,
            location: form.location,
            description: form.description,
            requirements: form.requirements,
            employmentType: form.employmentType,
            isHiring: form.isHiring,
            assignmentRequired: form.assignmentRequired,
            interviewScheduling: {
                enabled: form.interviewSchedulingEnabled,
                active: form.interviewSchedulingEnabled,
                timezone: form.interviewTimezone,
                organizerName: form.interviewOrganizerName,
                availableFrom: form.interviewAvailableFrom
                    ? new Date(form.interviewAvailableFrom).toISOString()
                    : undefined,
                availableTo: form.interviewAvailableTo
                    ? new Date(form.interviewAvailableTo).toISOString()
                    : undefined,
                weekdays: form.interviewWeekdays,
                dailySlots: [
                    {
                        startTime: form.interviewSlotStart,
                        endTime: form.interviewSlotEnd,
                    },
                ],
                durationMinutes: Number(form.interviewDurationMinutes),
                slotIntervalMinutes: Number(form.interviewSlotIntervalMinutes),
                minimumBookingNoticeMinutes: Number(form.interviewMinimumBookingNoticeMinutes),
                beforeEventBufferMinutes: Number(form.interviewBeforeEventBufferMinutes),
                afterEventBufferMinutes: Number(form.interviewAfterEventBufferMinutes),
            },
        };

        try {
            if (isEdit && id) {
                await updateJob({ id, data: payload }).unwrap();
            } else {
                await createJob(payload).unwrap();
            }
            navigate('/hiring/jobs');
        } catch (err: any) {
            setServerError(
                err?.data?.message || 'Something went wrong. Please try again.'
            );
        }
    };

    if (isEdit && isLoadingJob) {
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
                    Loading job…
                </div>
            </div>
        );
    }

    return (
        <div
            className="px-8 py-6 max-w-[720px] mx-auto"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >
            {/* ── Back + Title ─────────────────────────── */}
            <button
                onClick={() => navigate('/hiring/jobs')}
                className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-muted)';
                }}
            >
                <ChevronLeft size={16} />
                Back to Jobs
            </button>

            <h1
                className="text-2xl font-bold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
            >
                {isEdit ? 'Edit Job Posting' : 'Create Job Posting'}
            </h1>
            <p
                className="text-sm mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
            >
                {isEdit
                    ? 'Update the details of this job posting'
                    : 'Fill in the details to publish a new job position'}
            </p>

            {/* ── Server error ─────────────────────────── */}
            {serverError && (
                <div
                    className="flex items-center gap-2 px-4 py-3 rounded-lg mb-6 text-sm"
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

            {/* ── Form ─────────────────────────────────── */}
            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-6"
                noValidate
            >
                {/* Card: Basic Info */}
                <div
                    className="rounded-xl p-6 flex flex-col gap-5"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-default)',
                    }}
                >
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Basic Information
                    </h2>

                    <Field label="Job Title" required error={errors.title}>
                        <input
                            type="text"
                            value={form.title}
                            onChange={set('title')}
                            placeholder="e.g. Frontend Developer"
                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                            style={inputStyle}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor =
                                    'var(--color-primary)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor =
                                    'var(--color-border-default)';
                            }}
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Department" required error={errors.department}>
                            <input
                                type="text"
                                value={form.department}
                                onChange={set('department')}
                                placeholder="e.g. Engineering"
                                className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                style={inputStyle}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor =
                                        'var(--color-primary)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor =
                                        'var(--color-border-default)';
                                }}
                            />
                        </Field>

                        <Field label="Location" required error={errors.location}>
                            <input
                                type="text"
                                value={form.location}
                                onChange={set('location')}
                                placeholder="e.g. Remote / Bengaluru"
                                className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                style={inputStyle}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor =
                                        'var(--color-primary)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor =
                                        'var(--color-border-default)';
                                }}
                            />
                        </Field>
                    </div>

                    <Field label="Employment Type">
                        <select
                            value={form.employmentType}
                            onChange={set('employmentType')}
                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                            style={inputStyle}
                        >
                            <option value="full-time">Full-time</option>
                            <option value="part-time">Part-time</option>
                            <option value="contract">Contract</option>
                            <option value="internship">Internship</option>
                        </select>
                    </Field>
                </div>

                {/* Card: Description */}
                <div
                    className="rounded-xl p-6 flex flex-col gap-5"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-default)',
                    }}
                >
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Role Details
                    </h2>

                    <Field label="Job Description" required error={errors.description}>
                        <textarea
                            value={form.description}
                            onChange={set('description')}
                            rows={5}
                            placeholder="Describe the role, responsibilities, and what the candidate will be doing…"
                            className="px-3 py-2.5 text-sm rounded-lg border w-full resize-y"
                            style={inputStyle}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor =
                                    'var(--color-primary)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor =
                                    'var(--color-border-default)';
                            }}
                        />
                    </Field>

                    <Field label="Requirements" required error={errors.requirements}>
                        <textarea
                            value={form.requirements}
                            onChange={set('requirements')}
                            rows={4}
                            placeholder="List skills, qualifications, and experience required…"
                            className="px-3 py-2.5 text-sm rounded-lg border w-full resize-y"
                            style={inputStyle}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor =
                                    'var(--color-primary)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor =
                                    'var(--color-border-default)';
                            }}
                        />
                    </Field>
                </div>

                {/* Card: Settings */}
                <div
                    className="rounded-xl p-6 flex flex-col gap-4"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-default)',
                    }}
                >
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Settings
                    </h2>

                    {/* Hiring toggle */}
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={form.isHiring}
                                onChange={set('isHiring')}
                                className="sr-only"
                            />
                            <div
                                className="w-10 h-6 rounded-full transition-colors duration-200"
                                style={{
                                    backgroundColor: form.isHiring
                                        ? 'var(--color-primary)'
                                        : 'var(--color-border-default)',
                                }}
                            />
                            <div
                                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                                style={{
                                    transform: form.isHiring
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
                                Actively Hiring
                            </p>
                            <p
                                className="text-xs"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                When on, this job will appear on the public website
                            </p>
                        </div>
                    </label>

                    {/* Assignment required toggle */}
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={form.assignmentRequired}
                                onChange={set('assignmentRequired')}
                                className="sr-only"
                            />
                            <div
                                className="w-10 h-6 rounded-full transition-colors duration-200"
                                style={{
                                    backgroundColor: form.assignmentRequired
                                        ? 'var(--color-primary)'
                                        : 'var(--color-border-default)',
                                }}
                            />
                            <div
                                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                                style={{
                                    transform: form.assignmentRequired
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
                                Assignment Required
                            </p>
                            <p
                                className="text-xs"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                Shortlisted candidates will receive a task assignment
                            </p>
                        </div>
                    </label>

                    <div
                        className="rounded-lg border p-4 mt-2 flex flex-col gap-4"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p
                                    className="text-sm font-medium"
                                    style={{ color: 'var(--color-text-primary)' }}
                                >
                                    Interview Scheduling (Cal.com)
                                </p>
                                <p
                                    className="text-xs"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    Configure role-specific interview slots and sync to Cal.com.
                                </p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={form.interviewSchedulingEnabled}
                                    onChange={set('interviewSchedulingEnabled')}
                                />
                                <span
                                    className="text-xs"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    Enabled
                                </span>
                            </label>
                        </div>

                        {isEdit && jobData?.data.job?.interviewScheduling && (
                            <div
                                className="rounded-md border px-3 py-2 text-xs"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                    backgroundColor: 'var(--color-bg-subtle)',
                                }}
                            >
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span>
                                        Sync: <strong>{jobData.data.job.interviewScheduling.syncStatus}</strong>
                                    </span>
                                    <span>
                                        Active: <strong>{jobData.data.job.interviewScheduling.active ? 'yes' : 'no'}</strong>
                                    </span>
                                    <span>
                                        URL: <strong>{jobData.data.job.interviewScheduling.bookingUrl ? 'available' : 'missing'}</strong>
                                    </span>
                                    <span>
                                        Last synced:{' '}
                                        <strong>
                                            {jobData.data.job.interviewScheduling.lastSyncedAt
                                                ? new Date(
                                                      jobData.data.job.interviewScheduling.lastSyncedAt
                                                  ).toLocaleString('en-IN')
                                                : '—'}
                                        </strong>
                                    </span>
                                </div>
                                {jobData.data.job.interviewScheduling.syncError && (
                                    <p
                                        className="mt-2"
                                        style={{ color: 'var(--color-danger)' }}
                                    >
                                        Sync error: {jobData.data.job.interviewScheduling.syncError}
                                    </p>
                                )}
                            </div>
                        )}

                        {form.interviewSchedulingEnabled && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Timezone">
                                        <input
                                            type="text"
                                            value={form.interviewTimezone}
                                            onChange={set('interviewTimezone')}
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                    <Field label="Organizer">
                                        <input
                                            type="text"
                                            value={form.interviewOrganizerName}
                                            onChange={set('interviewOrganizerName')}
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Available From">
                                        <input
                                            type="datetime-local"
                                            value={form.interviewAvailableFrom}
                                            onChange={set('interviewAvailableFrom')}
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                    <Field label="Available To">
                                        <input
                                            type="datetime-local"
                                            value={form.interviewAvailableTo}
                                            onChange={set('interviewAvailableTo')}
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
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {WEEKDAY_OPTIONS.map((item) => {
                                            const checked = form.interviewWeekdays.includes(item.value);
                                            return (
                                                <label
                                                    key={item.value}
                                                    className="flex items-center gap-1.5 text-xs"
                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            setForm((prev) => {
                                                                const next = e.target.checked
                                                                    ? [...prev.interviewWeekdays, item.value]
                                                                    : prev.interviewWeekdays.filter(
                                                                          (value) => value !== item.value
                                                                      );
                                                                return {
                                                                    ...prev,
                                                                    interviewWeekdays: next.sort((a, b) => a - b),
                                                                };
                                                            });
                                                        }}
                                                    />
                                                    {item.label}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Daily Slot Start">
                                        <input
                                            type="time"
                                            value={form.interviewSlotStart}
                                            onChange={set('interviewSlotStart')}
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                    <Field label="Daily Slot End">
                                        <input
                                            type="time"
                                            value={form.interviewSlotEnd}
                                            onChange={set('interviewSlotEnd')}
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <Field label="Duration (min)">
                                        <input
                                            type="number"
                                            min={10}
                                            max={240}
                                            value={form.interviewDurationMinutes}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    interviewDurationMinutes: Number(e.target.value) || 0,
                                                }))
                                            }
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                    <Field label="Slot Interval (min)">
                                        <input
                                            type="number"
                                            min={5}
                                            max={180}
                                            value={form.interviewSlotIntervalMinutes}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    interviewSlotIntervalMinutes:
                                                        Number(e.target.value) || 0,
                                                }))
                                            }
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                    <Field label="Min Notice (min)">
                                        <input
                                            type="number"
                                            min={0}
                                            max={43200}
                                            value={form.interviewMinimumBookingNoticeMinutes}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    interviewMinimumBookingNoticeMinutes:
                                                        Number(e.target.value) || 0,
                                                }))
                                            }
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Before Buffer (min)">
                                        <input
                                            type="number"
                                            min={0}
                                            max={120}
                                            value={form.interviewBeforeEventBufferMinutes}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    interviewBeforeEventBufferMinutes:
                                                        Number(e.target.value) || 0,
                                                }))
                                            }
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                    <Field label="After Buffer (min)">
                                        <input
                                            type="number"
                                            min={0}
                                            max={120}
                                            value={form.interviewAfterEventBufferMinutes}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    interviewAfterEventBufferMinutes:
                                                        Number(e.target.value) || 0,
                                                }))
                                            }
                                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                            style={inputStyle}
                                        />
                                    </Field>
                                </div>
                            </>
                        )}

                        {errors.interviewScheduling && (
                            <p
                                className="text-xs"
                                style={{ color: 'var(--color-danger)' }}
                            >
                                {errors.interviewScheduling}
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Submit ───────────────────────────────── */}
                <div className="flex justify-end gap-3 pb-8">
                    <button
                        type="button"
                        onClick={() => navigate('/hiring/jobs')}
                        className="px-5 py-2.5 text-sm rounded-lg border"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                        onMouseEnter={(e) => {
                            if (!isSubmitting)
                                e.currentTarget.style.backgroundColor =
                                    'var(--color-primary-dark)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                                'var(--color-primary)';
                        }}
                    >
                        {isSubmitting && (
                            <Loader2 size={14} className="animate-spin" />
                        )}
                        {isEdit ? 'Save Changes' : 'Create Job'}
                    </button>
                </div>
            </form>
        </div>
    );
}
