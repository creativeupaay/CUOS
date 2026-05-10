import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    ExternalLink,
    Loader2,
    PanelTopOpen,
    RefreshCw,
    Save,
} from 'lucide-react';
import {
    useGetJobByIdQuery,
    useGetJobsQuery,
    useUpdateJobMutation,
    HiringInterviewTabs,
    useScheduleForm,
    ScheduleGeneralSettings,
    ScheduleRangeSelector,
    ScheduleReminders,
    ScheduleDateOverrides,
    ScheduleSummarySidebar,
    ScheduleCopyModal,
    type ReminderUnit,
} from '@/features/hiring';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayLocalDateInput() {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
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

const WEEKDAY_OPTIONS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

function formatWeekdaysForSummary(days?: number[]) {
    if (!Array.isArray(days) || days.length === 0) return '-';
    const labels = days
        .slice()
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_OPTIONS.find((item) => item.value === day)?.label)
        .filter(Boolean);
    return labels.length ? labels.join(', ') : '-';
}

function formatRangesForSummary(ranges?: Array<{ startDate?: string; endDate?: string }>) {
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

const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HiringInterviewSchedulePage() {
    const todayDateInput = useMemo(() => getTodayLocalDateInput(), []);

    // ── Page-level UI state ───────────────────────────────────────────────────
    const [selectedJobId, setSelectedJobId] = useState('');
    const [serverError, setServerError] = useState('');
    const [savedMessage, setSavedMessage] = useState('');
    const [isForceSyncing, setIsForceSyncing] = useState(false);
    const [copyPanelDay, setCopyPanelDay] = useState<number | null>(null);
    const [copyTargets, setCopyTargets] = useState<number[]>([]);
    const [isJobCopyModalOpen, setIsJobCopyModalOpen] = useState(false);
    const [copySourceJobId, setCopySourceJobId] = useState('');
    const copyPanelRef = useRef<HTMLDivElement | null>(null);

    // ── Form hook ────────────────────────────────────────────────────────────
    const {
        form,
        errors,
        activeRangeIndex,
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
    } = useScheduleForm();

    // ── API ──────────────────────────────────────────────────────────────────
    const { data: jobsData, isLoading: isLoadingJobs } = useGetJobsQuery({ limit: 200 });
    const jobs = useMemo(() => jobsData?.data.jobs || [], [jobsData?.data.jobs]);

    const {
        data: jobData,
        isFetching: isLoadingJob,
        refetch: refetchJob,
    } = useGetJobByIdQuery(selectedJobId, { skip: !selectedJobId });

    const [updateJob, { isLoading: isSaving }] = useUpdateJobMutation();

    const { data: copySourceJobData, isFetching: isLoadingCopySourceJob } = useGetJobByIdQuery(
        copySourceJobId,
        { skip: !copySourceJobId }
    );

    // ── Derived ──────────────────────────────────────────────────────────────
    const selectedJob = jobData?.data.job;
    const isWorking = isSaving || isForceSyncing;

    const sourceJobs = useMemo(
        () => jobs.filter((job) => job._id !== selectedJobId),
        [jobs, selectedJobId]
    );

    const syncedSummary = useMemo(() => {
        const scheduling = selectedJob?.interviewScheduling;
        if (!scheduling) return null;
        const slotLabel =
            Array.isArray(scheduling.dailySlots) && scheduling.dailySlots.length
                ? scheduling.dailySlots.map((slot) => `${slot.startTime} - ${slot.endTime}`).join(', ')
                : '-';
        return {
            timezone: scheduling.timezone || '-',
            weekdays: formatWeekdaysForSummary(scheduling.weekdays),
            hours: slotLabel,
            availableRanges: formatRangesForSummary(scheduling.availableRanges),
            dateOverridesCount: Array.isArray(scheduling.dateOverrides) ? scheduling.dateOverrides.length : 0,
            durationMinutes: scheduling.durationMinutes ?? '-',
            beforeEventBufferMinutes: scheduling.beforeEventBufferMinutes ?? '-',
            afterEventBufferMinutes: scheduling.afterEventBufferMinutes ?? '-',
            reminderMinutesBefore: Array.isArray(scheduling.reminderMinutesBefore)
                ? scheduling.reminderMinutesBefore.map((m) => formatReminderLabel(m)).join(', ')
                : '-',
            eventTypeId: scheduling.eventTypeId || '-',
            scheduleId: scheduling.scheduleId || '-',
        };
    }, [selectedJob]);

    const copySourceJob = copySourceJobData?.data.job;
    const copySourceSummary = useMemo(() => {
        const scheduling = copySourceJob?.interviewScheduling;
        if (!scheduling) return null;
        return {
            weekdays: formatWeekdaysForSummary(scheduling.weekdays),
            hours:
                Array.isArray(scheduling.dailySlots) && scheduling.dailySlots.length
                    ? scheduling.dailySlots.map((s) => `${s.startTime} - ${s.endTime}`).join(', ')
                    : '-',
            availableRanges: formatRangesForSummary(scheduling.availableRanges),
        };
    }, [copySourceJob]);

    // ── Effects ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!selectedJobId && jobs.length > 0) setSelectedJobId(jobs[0]._id);
    }, [jobs, selectedJobId]);

    useEffect(() => {
        if (!jobData?.data.job) return;
        loadFromJob(jobData.data.job);
        setServerError('');
    }, [jobData, loadFromJob]);

    useEffect(() => {
        if (!isJobCopyModalOpen) return;
        const hasValidSelection = sourceJobs.some((job) => job._id === copySourceJobId);
        if (!hasValidSelection) setCopySourceJobId(sourceJobs[0]?._id || '');
    }, [isJobCopyModalOpen, sourceJobs, copySourceJobId]);

    useEffect(() => {
        if (copyPanelDay === null) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (!copyPanelRef.current) return;
            if (!copyPanelRef.current.contains(event.target as Node)) {
                setCopyPanelDay(null);
                setCopyTargets([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [copyPanelDay]);

    useEffect(() => {
        if (!isJobCopyModalOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isJobCopyModalOpen]);

    // ── Copy-panel handlers ──────────────────────────────────────────────────
    const activeRangeDaySchedules =
        form.availableRanges[activeRangeIndex]?.daySchedules ?? form.daySchedules;

    const handleOpenCopyPanel = (day: number) => {
        setCopyPanelDay(day);
        setCopyTargets([day]);
    };

    const handleToggleCopyTarget = (day: number) => {
        setCopyTargets((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const handleToggleCopyAllTargets = () => {
        setCopyTargets((prev) =>
            prev.length === WEEKDAY_OPTIONS.length ? [] : WEEKDAY_OPTIONS.map((d) => d.value)
        );
    };

    const handleApplyCopyTargets = () => {
        if (copyPanelDay === null) return;
        const source = activeRangeDaySchedules[copyPanelDay];
        if (!source) { setCopyPanelDay(null); return; }
        // Apply slots from source day to all copy targets
        copyTargets.forEach((targetDay) => {
            source.slots.forEach((slot, slotIdx) => {
                setDaySlotTimeAtIndex(targetDay, slotIdx, 'startTime', slot.startTime);
                setDaySlotTimeAtIndex(targetDay, slotIdx, 'endTime', slot.endTime);
            });
        });
        setCopyPanelDay(null);
        clearErrors();
    };

    const handleCloseCopyPanel = () => {
        setCopyPanelDay(null);
        setCopyTargets([]);
    };

    // ── Save / Sync ───────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!selectedJobId) return;
        setServerError('');
        setSavedMessage('');
        try {
            await updateJob({ id: selectedJobId, data: buildSchedulingPayload() }).unwrap();
            await refetchJob();
            setSavedMessage('Interview schedule saved and synced.');
        } catch (err: unknown) {
            const message =
                (err as { data?: { message?: string } })?.data?.message ??
                'Could not update interview scheduling right now.';
            setServerError(message);
        }
    };

    const handleForceSync = async () => {
        if (!selectedJobId || !form.enabled) return;
        setServerError('');
        setSavedMessage('');
        setIsForceSyncing(true);
        try {
            await updateJob({ id: selectedJobId, data: buildSchedulingPayload() }).unwrap();
            await refetchJob();
            setSavedMessage('Cal.com re-sync completed.');
        } catch (err: unknown) {
            const message =
                (err as { data?: { message?: string } })?.data?.message ??
                'Could not re-sync this job with Cal.com right now.';
            setServerError(message);
        } finally {
            setIsForceSyncing(false);
        }
    };

    // ── Copy-modal handlers ───────────────────────────────────────────────────
    const handleApplyCopiedJobSchedule = () => {
        if (!copySourceJob?.interviewScheduling) return;
        loadFromJob(copySourceJob);
        setServerError('');
        setSavedMessage(`Schedule copied from ${copySourceJob.title}. Review and click Save to apply.`);
        setIsJobCopyModalOpen(false);
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (isLoadingJobs) {
        return (
            <div
                className="flex items-center justify-center h-[calc(100vh-64px)]"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading jobs...
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
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
                    <CalendarDays size={28} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        No jobs available yet.
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Create a job posting first, then come here to configure its interview schedule.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* ── Job Selector ── */}
                    <div
                        className="rounded-xl p-6 border"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                Job Posting
                            </label>
                            <div className="flex flex-wrap items-center gap-3">
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
                                <button
                                    type="button"
                                    onClick={() => setIsJobCopyModalOpen(true)}
                                    disabled={sourceJobs.length === 0}
                                    className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        color: 'var(--color-text-primary)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        opacity: sourceJobs.length === 0 ? 0.6 : 1,
                                    }}
                                >
                                    <PanelTopOpen size={15} />
                                    Copy Schedule
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Loading job ── */}
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
                            {/* ── Error banner ── */}
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

                            {/* ── Success banner ── */}
                            {savedMessage && (
                                <div
                                    className="px-4 py-3 rounded-lg text-sm"
                                    style={{
                                        backgroundColor: 'var(--color-success-soft)',
                                        color: 'var(--color-success)',
                                        border: '1px solid var(--color-success)',
                                    }}
                                >
                                    {savedMessage}
                                </div>
                            )}

                            {/* ── Main card ── */}
                            <div
                                className="rounded-xl border p-6 space-y-5"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                            >
                                {/* Job header */}
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <h2
                                            className="text-sm font-semibold"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {selectedJob?.title}
                                        </h2>
                                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                            {selectedJob?.department}
                                            {selectedJob?.location ? ` - ${selectedJob.location}` : ''}
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

                                {/* Sync status + last synced summary */}
                                {selectedJob && (
                                    <ScheduleSummarySidebar job={selectedJob} syncedSummary={syncedSummary} />
                                )}

                                {/* Enable toggle */}
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={form.enabled}
                                            onChange={(e) => setFormField('enabled', e.target.checked)}
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
                                                transform: form.enabled ? 'translateX(16px)' : 'translateX(0)',
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            Enable interview scheduling
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            Turn this on to sync job-specific interview availability to Cal.com.
                                        </p>
                                    </div>
                                </label>

                                {form.enabled && (
                                    <>
                                        {/* General settings */}
                                        <ScheduleGeneralSettings form={form} setFormField={setFormField} />

                                        {/* Date ranges + working hours */}
                                        <ScheduleRangeSelector
                                            form={form}
                                            activeRangeIndex={activeRangeIndex}
                                            todayDateInput={todayDateInput}
                                            copiedRangeLabel={copiedRangeLabel}
                                            copiedRangeDaySchedules={copiedRangeDaySchedules}
                                            copyPanelDay={copyPanelDay}
                                            copyTargets={copyTargets}
                                            copyPanelRef={copyPanelRef}
                                            workingHoursSummary={workingHoursSummary}
                                            onSetActiveRangeIndex={setActiveRangeIndex}
                                            onAddRange={addRange}
                                            onRemoveRange={removeRange}
                                            onSetRangeValue={setRangeValue}
                                            onToggleWeekday={toggleWeekday}
                                            onSetDaySlotTimeAtIndex={setDaySlotTimeAtIndex}
                                            onAddDaySlot={addDaySlot}
                                            onRemoveDaySlot={removeDaySlot}
                                            onOpenCopyPanel={handleOpenCopyPanel}
                                            onToggleCopyTarget={handleToggleCopyTarget}
                                            onToggleCopyAllTargets={handleToggleCopyAllTargets}
                                            onApplyCopyTargets={handleApplyCopyTargets}
                                            onCloseCopyPanel={handleCloseCopyPanel}
                                            onCopyCurrentRangeSchedule={copyDayScheduleFromRange}
                                            onPasteToCurrentRangeSchedule={applyDayScheduleCopy}
                                        />

                                        {/* Reminders */}
                                        <ScheduleReminders
                                            form={form}
                                            onToggleReminderOption={toggleReminderOption}
                                            onChangeCustomReminderValue={(v) => setFormField('customReminderValue', v)}
                                            onChangeCustomReminderUnit={(v) =>
                                                setFormField('customReminderUnit', v as ReminderUnit)
                                            }
                                            onAddCustomReminder={addCustomReminder}
                                            onRemoveReminder={removeReminder}
                                        />

                                        {/* Date overrides */}
                                        <ScheduleDateOverrides
                                            dateOverrides={form.dateOverrides}
                                            availableRangeDates={availableRangeDates}
                                            onAddDateOverride={() => addDateOverride(availableRangeDates)}
                                            onRemoveDateOverride={removeDateOverride}
                                            onSetDateOverrideDate={setDateOverrideDate}
                                            onAddDateOverrideSlot={addDateOverrideSlot}
                                            onRemoveDateOverrideSlot={removeDateOverrideSlot}
                                            onSetDateOverrideSlotTime={setDateOverrideSlotTime}
                                        />

                                        {/* Validation error */}
                                        {errors.schedule && (
                                            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                                                {errors.schedule}
                                            </p>
                                        )}
                                    </>
                                )}

                                {/* Action buttons */}
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={isWorking}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                                        style={{
                                            backgroundColor: 'var(--color-primary)',
                                            color: '#fff',
                                            opacity: isWorking ? 0.7 : 1,
                                        }}
                                    >
                                        {isSaving ? (
                                            <Loader2 size={15} className="animate-spin" />
                                        ) : (
                                            <Save size={15} />
                                        )}
                                        Save Schedule
                                    </button>

                                    {form.enabled && (
                                        <button
                                            type="button"
                                            onClick={handleForceSync}
                                            disabled={isWorking}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                color: 'var(--color-text-primary)',
                                                backgroundColor: 'var(--color-bg-surface)',
                                                opacity: isWorking ? 0.7 : 1,
                                            }}
                                        >
                                            {isForceSyncing ? (
                                                <Loader2 size={15} className="animate-spin" />
                                            ) : (
                                                <RefreshCw size={15} />
                                            )}
                                            Force Re-sync
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Job copy modal ── */}
            <ScheduleCopyModal
                isOpen={isJobCopyModalOpen}
                sourceJobs={sourceJobs}
                copySourceJobId={copySourceJobId}
                copySourceSummary={copySourceSummary}
                isLoadingCopySourceJob={isLoadingCopySourceJob}
                onClose={() => setIsJobCopyModalOpen(false)}
                onChangeCopySourceJobId={setCopySourceJobId}
                onApply={handleApplyCopiedJobSchedule}
            />
        </div>
    );
}
