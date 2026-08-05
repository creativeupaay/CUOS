import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetProjectTimeLogsQuery,
    useGetMyTimeLogsQuery,
    useGetTasksQuery,
    useUpdateTimeLogMutation,
    type TimeLog,
} from '@/features/project';
import { Loader2, Clock, ShieldOff, CheckCircle2, TrendingUp, TrendingDown, User, Play, Pause, SquareCheckBig, ChevronDown, ChevronUp, Pencil, X, Save } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
};

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const fmtDateTime = (iso: string) =>
    `${fmtDate(iso)}, ${fmtTime(iso)}`;

const SUPER_ADMIN_ROLES = ['super-admin', 'super_admin', 'admin'];
const TIME_LOG_EDITOR_ROLES = ['super-admin', 'super_admin'];

const toDateInputValue = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

const toDateTimeInputValue = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toIsoFromDateTimeInput = (value: string) => value ? new Date(value).toISOString() : undefined;

const addMinutesToInput = (value: string, minutes: number) => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime()) || !Number.isFinite(minutes)) return '';
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() + minutes * 60 * 1000 - offsetMs).toISOString().slice(0, 16);
};

const minutesBetweenInputs = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!start || !end || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    const minutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    return minutes > 0 ? minutes : null;
};

const moveInputToDate = (value: string, dateValue: string) => {
    if (!value || !dateValue) return value;
    const time = value.slice(11, 16) || '09:00';
    return `${dateValue}T${time}`;
};

const createDefaultStart = (dateValue: string) => `${dateValue}T09:00`;

const buildInitialEditForm = (log: TimeLog): EditTimeLogForm => {
    const date = toDateInputValue(log.date) || toDateInputValue(log.startTime) || toDateInputValue(log.endTime);
    const duration = Math.max(1, Number(log.duration || 1));
    let startTime = toDateTimeInputValue(log.startTime);
    let endTime = toDateTimeInputValue(log.endTime);

    if (!startTime && endTime) {
        startTime = addMinutesToInput(endTime, -duration);
    }

    if (!startTime && date) {
        startTime = createDefaultStart(date);
    }

    if (!endTime && startTime) {
        endTime = addMinutesToInput(startTime, duration);
    }

    return {
        date,
        duration: String(duration),
        startTime,
        endTime,
        description: log.description || '',
        billable: log.billable !== false,
    };
};

interface EditTimeLogForm {
    date: string;
    duration: string;
    startTime: string;
    endTime: string;
    description: string;
    billable: boolean;
}

// ─── Activity event derived from a time log ────────────────────────────────
interface ActivityEvent {
    id: string;
    type: 'started' | 'paused' | 'completed';
    at: string;          // ISO date string
    userName: string;
    taskTitle: string;
    durationMins?: number; // only for paused / completed events
}

export default function ProjectTimeLogsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const currentUser = useSelector((s: RootState) => s.auth.user);

    const [showActivity, setShowActivity] = useState(true);
    const [editingLog, setEditingLog] = useState<TimeLog | null>(null);
    const [editForm, setEditForm] = useState<EditTimeLogForm>({
        date: '',
        duration: '',
        startTime: '',
        endTime: '',
        description: '',
        billable: true,
    });
    const [updateTimeLog, { isLoading: isUpdatingTimeLog }] = useUpdateTimeLogMutation();
    useBodyScrollLock(Boolean(editingLog));

    // Resolve role name (role can be a Role object or a string)
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? (currentUser.role as { name: string }).name?.toLowerCase()
            : String(currentUser.role).toLowerCase()
        : '';

    const isSuperAdmin = SUPER_ADMIN_ROLES.includes(roleName);
    const canEditTimeLogs = TIME_LOG_EDITOR_ROLES.includes(roleName);

    // Project-specific permissions
    const pmPerms = currentUser?.modulePermissions?.projectManagement;
    const projectEntry = pmPerms?.projectPermissions?.find((p: { projectId: string }) => p.projectId === projectId);

    // Super admin or user with explicit timeLogs sub-permission → sees ALL logs
    const canSeeAll = isSuperAdmin || (projectEntry?.subModules?.timeLogs === true);

    // Any project member (has a projectEntry) can see at minimum their own logs
    const isProjectMember = isSuperAdmin || Boolean(projectEntry);

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: allLogsData, isLoading: allLogsLoading } = useGetProjectTimeLogsQuery(
        { projectId: projectId! },
        { skip: !canSeeAll }
    );

    const { data: myLogsData, isLoading: myLogsLoading } = useGetMyTimeLogsQuery(
        { projectId: projectId! },
        { skip: canSeeAll || !isProjectMember }
    );

    const { data: tasksData } = useGetTasksQuery(
        { projectId: projectId! },
        { skip: !isProjectMember }
    );
    const tasks = tasksData?.data || [];

    const isLoading = canSeeAll ? allLogsLoading : myLogsLoading;
    const timeLogs = canSeeAll ? (allLogsData?.data || []) : (myLogsData?.data || []);

    const openEditTimeLog = (log: TimeLog) => {
        setEditingLog(log);
        setEditForm(buildInitialEditForm(log));
    };

    const closeEditTimeLog = () => {
        setEditingLog(null);
        setEditForm({
            date: '',
            duration: '',
            startTime: '',
            endTime: '',
            description: '',
            billable: true,
        });
    };

    const saveEditedTimeLog = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingLog) return;

        const duration = Number(editForm.duration);
        if (!Number.isFinite(duration) || duration <= 0) {
            alert('Duration must be greater than 0 minutes');
            return;
        }

        try {
            await updateTimeLog({
                id: editingLog._id,
                data: {
                    date: editForm.date,
                    duration,
                    startTime: toIsoFromDateTimeInput(editForm.startTime),
                    endTime: toIsoFromDateTimeInput(editForm.endTime),
                    description: editForm.description.trim(),
                    billable: editForm.billable,
                },
            }).unwrap();
            closeEditTimeLog();
        } catch (err: unknown) {
            const error = err as { data?: { message?: string }; message?: string };
            alert(error?.data?.message || error?.message || 'Failed to update time log');
        }
    };

    const handleEditDateChange = (date: string) => {
        setEditForm((prev) => ({
            ...prev,
            date,
            startTime: moveInputToDate(prev.startTime, date),
            endTime: moveInputToDate(prev.endTime, date),
        }));
    };

    const handleEditDurationChange = (durationValue: string) => {
        setEditForm((prev) => {
            const duration = Number(durationValue);
            const next = { ...prev, duration: durationValue };

            if (Number.isFinite(duration) && duration > 0) {
                if (prev.startTime) {
                    next.endTime = addMinutesToInput(prev.startTime, duration);
                } else if (prev.endTime) {
                    next.startTime = addMinutesToInput(prev.endTime, -duration);
                    next.date = toDateInputValue(next.startTime) || prev.date;
                }
            }

            return next;
        });
    };

    const handleEditStartTimeChange = (startTime: string) => {
        setEditForm((prev) => {
            const duration = Number(prev.duration);
            const next = {
                ...prev,
                startTime,
                date: toDateInputValue(startTime) || prev.date,
            };

            if (Number.isFinite(duration) && duration > 0) {
                next.endTime = addMinutesToInput(startTime, duration);
            } else if (prev.endTime) {
                const calculatedDuration = minutesBetweenInputs(startTime, prev.endTime);
                if (calculatedDuration !== null) {
                    next.duration = String(calculatedDuration);
                }
            }

            return next;
        });
    };

    const handleEditEndTimeChange = (endTime: string) => {
        setEditForm((prev) => {
            const next = { ...prev, endTime };
            const calculatedDuration = minutesBetweenInputs(prev.startTime, endTime);

            if (calculatedDuration !== null) {
                next.duration = String(calculatedDuration);
            } else {
                const duration = Number(prev.duration);
                if (Number.isFinite(duration) && duration > 0 && endTime) {
                    next.startTime = addMinutesToInput(endTime, -duration);
                    next.date = toDateInputValue(next.startTime) || prev.date;
                }
            }

            return next;
        });
    };

    // ── Access Restricted ─────────────────────────────────────────────────────
    if (!isProjectMember) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-danger-soft, rgba(239,68,68,0.1))' }}>
                    <ShieldOff size={28} style={{ color: 'var(--color-danger)' }} />
                </div>
                <div className="text-center">
                    <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        Access Restricted
                    </h3>
                    <p className="text-sm max-w-sm" style={{ color: 'var(--color-text-muted)' }}>
                        You are not assigned to this project.
                    </p>
                </div>
            </div>
        );
    }

    // ── Summary calculations ──────────────────────────────────────────────────
    const actualMins = timeLogs.reduce((sum, log) => sum + log.duration, 0);
    const expectedMins = tasks.reduce((sum, t) => sum + ((t.estimatedHours ?? 0) * 60), 0);
    const varianceMins = actualMins - expectedMins;
    const overEstimate = varianceMins > 0;

    // ── Derive activity events from time logs ─────────────────────────────────
    // Each time log represents one work session: startTime → endTime
    // We derive two activity events per log:
    //   1. "started"  at startTime
    //   2. "paused" or "completed" at endTime
    const activityEvents: ActivityEvent[] = [];
    timeLogs.forEach(log => {
        const user = typeof log.userId === 'object' ? (log.userId as { name?: string }) : null;
        const task = typeof log.taskId === 'object' ? (log.taskId as { title?: string }) : null;
        const userName = user?.name || '—';
        const taskTitle = task?.title || '—';
        const isCompleted = (log.description || '').toLowerCase().includes('completed');

        if (log.startTime) {
            activityEvents.push({
                id: `${log._id}-start`,
                type: 'started',
                at: log.startTime,
                userName,
                taskTitle,
            });
        }
        if (log.endTime) {
            activityEvents.push({
                id: `${log._id}-end`,
                type: isCompleted ? 'completed' : 'paused',
                at: log.endTime,
                userName,
                taskTitle,
                durationMins: log.duration,
            });
        }
    });
    // Sort chronologically descending (most recent first)
    activityEvents.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const VISIBLE_ACTIVITY = 12;
    const visibleEvents = showActivity ? activityEvents.slice(0, VISIBLE_ACTIVITY) : [];
    const logGridColumns = canSeeAll
        ? (canEditTimeLogs ? 'grid-cols-[120px_1fr_1fr_80px_1fr_88px]' : 'grid-cols-[120px_1fr_1fr_80px_1fr]')
        : 'grid-cols-[120px_1fr_80px_1fr]';

    // ── Activity event config ─────────────────────────────────────────────────
    const activityConfig: Record<ActivityEvent['type'], { icon: React.ElementType; color: string; bg: string; label: string }> = {
        started:   { icon: Play,           color: '#2563EB', bg: 'rgba(37,99,235,0.08)',  label: 'Started' },
        paused:    { icon: Pause,          color: '#D97706', bg: 'rgba(217,119,6,0.08)',  label: 'Paused'  },
        completed: { icon: SquareCheckBig, color: '#16A34A', bg: 'rgba(22,163,74,0.08)', label: 'Completed' },
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Time Logs
                    </h2>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                        {timeLogs.length} entries
                    </span>
                    {!canSeeAll && (
                        <span
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
                        >
                            <User size={10} /> My logs only
                        </span>
                    )}
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Auto-logged from task activity
                </p>
            </div>

            {/* Summary Cards */}
            <div className={`grid gap-4 ${canSeeAll ? 'grid-cols-3' : 'grid-cols-1 max-w-xs'}`}>
                <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        {canSeeAll ? 'Total Actual Hours' : 'My Logged Hours'}
                    </p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                        {(actualMins / 60).toFixed(1)}h
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {canSeeAll ? 'Across all team members' : 'Your time across all tasks in this project'}
                    </p>
                </div>
                {canSeeAll && (
                    <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <p className="text-xs mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Expected Hours</p>
                        <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>
                            {(expectedMins / 60).toFixed(1)}h
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Sum of estimated task hours</p>
                    </div>
                )}
                {canSeeAll && (
                    <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <p className="text-xs mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Variance</p>
                        {expectedMins > 0 ? (
                            <>
                                <div className="flex items-center gap-1.5">
                                    {overEstimate
                                        ? <TrendingUp size={18} style={{ color: 'var(--color-danger)' }} />
                                        : <TrendingDown size={18} style={{ color: 'var(--color-success)' }} />}
                                    <p className="text-2xl font-bold tabular-nums"
                                        style={{ color: overEstimate ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                        {overEstimate ? '+' : ''}{(varianceMins / 60).toFixed(1)}h
                                    </p>
                                </div>
                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                    {overEstimate ? 'Over estimate' : 'Within estimate'}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>No estimates set on tasks</p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Activity Feed ──────────────────────────────────────────────────── */}
            {activityEvents.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                    {/* Section header */}
                    <button
                        className="w-full flex items-center justify-between px-4 py-3 border-b text-left"
                        style={{
                            backgroundColor: 'var(--color-bg-subtle)',
                            borderColor: 'var(--color-border-default)',
                        }}
                        onClick={() => setShowActivity(v => !v)}
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={14} style={{ color: 'var(--color-text-secondary)' }} />
                            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                Task Activity
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
                                {activityEvents.length} events
                            </span>
                        </div>
                        {showActivity
                            ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} />
                            : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />}
                    </button>

                    {showActivity && (
                        <div className="divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
                            {visibleEvents.map(event => {
                                const cfg = activityConfig[event.type];
                                const Icon = cfg.icon;
                                return (
                                    <div
                                        key={event.id}
                                        className="flex items-center gap-3 px-4 py-3"
                                        style={{ backgroundColor: 'var(--color-bg-surface)' }}
                                    >
                                        {/* Icon badge */}
                                        <div
                                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: cfg.bg }}
                                        >
                                            <Icon size={13} style={{ color: cfg.color }} />
                                        </div>

                                        {/* Text */}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label} </span>
                                            <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                                                {event.taskTitle}
                                            </span>
                                            {canSeeAll && (
                                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}> · {event.userName}</span>
                                            )}
                                        </div>

                                        {/* Duration (for paused / completed) */}
                                        {event.durationMins !== undefined && (
                                            <span className="text-xs font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--color-primary)' }}>
                                                {fmt(event.durationMins)}
                                            </span>
                                        )}

                                        {/* Timestamp */}
                                        <span className="text-[10px] flex-shrink-0 text-right" style={{ color: 'var(--color-text-muted)' }}>
                                            {fmtDateTime(event.at)}
                                        </span>
                                    </div>
                                );
                            })}
                            {activityEvents.length > VISIBLE_ACTIVITY && (
                                <div className="px-4 py-2.5 text-center text-[11px]" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                                    Showing {VISIBLE_ACTIVITY} of {activityEvents.length} events — view log table below for full history
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Log Table */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                {/* Column headers — Member column only for admins/managers */}
                <div
                    className={`grid gap-3 px-4 py-2.5 border-b text-[11px] font-semibold uppercase tracking-wider ${logGridColumns}`}
                    style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                >
                    <span>Date</span>
                    {canSeeAll && <span>Member</span>}
                    <span>Task</span>
                    <span>Duration</span>
                    <span>Description</span>
                    {canEditTimeLogs && <span>Actions</span>}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
                ) : timeLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-2">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                            <Clock size={22} />
                        </div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No time logged yet</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Time is tracked automatically when you start and pause/complete tasks
                        </p>
                    </div>
                ) : (
                    timeLogs.map(log => {
                        const user = typeof log.userId === 'object' ? (log.userId as { name?: string }) : null;
                        const task = typeof log.taskId === 'object' ? (log.taskId as { title?: string }) : null;
                        const isCompleted = (log.description || '').toLowerCase().includes('completed');
                        const descColor = isCompleted ? 'var(--color-success)' : 'var(--color-text-secondary)';
                        return (
                            <div
                                key={log._id}
                                className={`grid gap-3 px-4 py-3 items-center border-b last:border-0 ${logGridColumns}`}
                                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                            >
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {fmtDate(log.date)}
                                </span>
                                {canSeeAll && (
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                            style={{ backgroundColor: '#6366F1' }}
                                        >
                                            {user?.name?.charAt(0) || '?'}
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {user?.name || '—'}
                                        </span>
                                    </div>
                                )}
                                <span className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }} title={task?.title}>
                                    {task?.title || '—'}
                                </span>
                                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                                    {fmt(log.duration)}
                                </span>
                                <span className="text-xs truncate font-medium" style={{ color: descColor }} title={log.description}>
                                    {log.description || '—'}
                                </span>
                                {canEditTimeLogs && (
                                    <button
                                        type="button"
                                        onClick={() => openEditTimeLog(log)}
                                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors hover:bg-black/5"
                                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                        title="Edit time log"
                                    >
                                        <Pencil size={12} />
                                        Edit
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {timeLogs.length > 0 && (
                <div className="flex items-center gap-2 text-xs px-1" style={{ color: 'var(--color-text-muted)' }}>
                    <CheckCircle2 size={12} />
                    {canSeeAll
                        ? 'Time logs are auto-generated from employee task activity and link to finance reporting.'
                        : 'Showing your logged time only. Total project view is available to project managers.'}
                </div>
            )}

            {editingLog && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
                    <form
                        onSubmit={saveEditedTimeLog}
                        className="w-full max-w-lg rounded-xl border shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div>
                                <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Edit Time Log</h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                    Correct wrongly marked task activity.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeEditTimeLog}
                                className="p-1.5 rounded-lg cursor-pointer hover:bg-black/5"
                                aria-label="Close edit time log"
                            >
                                <X size={16} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Date</span>
                                    <input
                                        type="date"
                                        required
                                        value={editForm.date}
                                        onChange={(e) => handleEditDateChange(e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                    />
                                </label>
                                <label className="block">
                                    <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Duration (minutes)</span>
                                    <input
                                        type="number"
                                        required
                                        min={1}
                                        value={editForm.duration}
                                        onChange={(e) => handleEditDurationChange(e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Start Time</span>
                                    <input
                                        type="datetime-local"
                                        value={editForm.startTime}
                                        onChange={(e) => handleEditStartTimeChange(e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                    />
                                </label>
                                <label className="block">
                                    <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>End Time</span>
                                    <input
                                        type="datetime-local"
                                        value={editForm.endTime}
                                        onChange={(e) => handleEditEndTimeChange(e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                    />
                                </label>
                            </div>

                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                <input
                                    type="checkbox"
                                    checked={editForm.billable}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, billable: e.target.checked }))}
                                    className="w-4 h-4 rounded"
                                />
                                Billable
                            </label>

                            <label className="block">
                                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description</span>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                />
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                            <button
                                type="button"
                                onClick={closeEditTimeLog}
                                className="px-4 py-2 text-sm rounded-lg border cursor-pointer"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isUpdatingTimeLog}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                                {isUpdatingTimeLog ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save
                            </button>
                        </div>
                    </form>
                </div>,
                document.body,
            )}
        </div>
    );
}
