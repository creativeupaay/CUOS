import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, CheckCircle2, Search, Loader2, Video, Calendar } from 'lucide-react';
import { LapIcon } from '@/components/atoms/LapIcon';
import toast from 'react-hot-toast';
import type { GlobalTask } from '@/hooks/useGlobalTasks';
import type { GlobalMeeting } from '@/hooks/useGlobalMeetings';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import { formatElapsed, type DaySessionMeta } from '@/hooks/useTaskTimer';
import type { Project } from '@/features/project';
import type { LapseRecord } from '@/hooks/useLapses';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskSummaryEntry {
    task: GlobalTask;
    allocatedMinutes: number;
    status: GlobalTask['status'];
    priority: GlobalTask['priority'];
    deadline: string;
    projectId: string;
    notes: string;
    /** True when this task's time was already logged via a lapse — do not re-log at EOD submit */
    lapseLogged?: boolean;
}

export interface MeetingSummaryEntry {
    meeting: GlobalMeeting;
    allocatedMinutes: number;
}

interface EndOfDayModalProps {
    allTasks: GlobalTask[];
    todayMeetings: GlobalMeeting[];
    projects: Project[];
    timerSeconds: number;
    breakSeconds?: number;
    daySessionMeta?: DaySessionMeta | null;
    /** All lapse records (assigned + unassigned) accumulated during the day */
    allLapses?: LapseRecord[];
    /** Unassigned lapse records accumulated during the day */
    pendingLapses?: LapseRecord[];
    onClose: () => void;
    onSubmit: (entries: TaskSummaryEntry[], meetingEntries: MeetingSummaryEntry[], unallocatedMinutes: number) => Promise<void>;
    onAddNewTask?: () => void;
    onAssignLapse?: (id: string, taskId: string, projectId: string, note?: string) => Promise<void> | void;
}

// ─── Config maps ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: GlobalTask['status']; label: string }[] = [
    { value: 'todo',        label: 'To Do'       },
    { value: 'in-progress', label: 'In Progress'  },
    { value: 'paused',      label: 'Paused'       },
    { value: 'completed',   label: 'Completed'    },
];

const PRIORITY_OPTIONS = [
    { value: 'low',      label: 'Low'      },
    { value: 'medium',   label: 'Medium'   },
    { value: 'high',     label: 'High'     },
    { value: 'critical', label: 'Critical' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function EndOfDayModal({
    allTasks,
    todayMeetings,
    projects,
    timerSeconds,
    breakSeconds = 0,
    daySessionMeta,
    allLapses = [],
    pendingLapses = [],
    onClose,
    onSubmit,
    onAddNewTask,
    onAssignLapse,
}: EndOfDayModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const currentUser = useSelector((state: RootState) => state.auth.user);
    const currentUserId = currentUser?._id;

const lastEndedAccumulated = daySessionMeta?.lastEndedAccumulated || 0;
    const lastEndedBreakAccumulated = daySessionMeta?.lastEndedBreakAccumulated || 0;
    const lastEndedWorkingSecondsForSplit = Math.max(0, lastEndedAccumulated - lastEndedBreakAccumulated);
    const isSecondSession = lastEndedAccumulated > 0;

    // Split lapses into first-session (already covered by the first EOD) and current-session.
    // Strategy: sort all assigned lapses by capturedAt, accumulate their seconds.
    // Once the cumulative sum exceeds lastEndedWorkingSeconds, remaining lapses belong to the current session.
    const assignedLapses = allLapses.filter(l => !!l.assignedTaskId);
    const { currentSessionAssigned } = useMemo(() => {
        if (!isSecondSession) {
            return { currentSessionAssigned: assignedLapses };
        }
        const sorted = [...assignedLapses].sort(
            (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        );
        let cumSeconds = 0;
        const curr: typeof assignedLapses = [];
        for (const l of sorted) {
            cumSeconds += l.seconds;
            if (cumSeconds > lastEndedWorkingSecondsForSplit) {
                curr.push(l);
            }
        }
        return { currentSessionAssigned: curr };
    }, [assignedLapses, isSecondSession, lastEndedWorkingSecondsForSplit]);

    // Minutes already logged via lapse in the CURRENT session only
    const alreadyAssignedLapseMinutes = currentSessionAssigned.reduce(
        (acc, l) => acc + Math.max(1, Math.round(l.seconds / 60)),
        0
    );
    // allAssignedLapseMinutesDisplay: total assigned lapse minutes for the whole day — available for future UI use

    // Pre-populate entries for tasks that had lapse time logged in the CURRENT session only.
    // lapseLogged: true prevents the EOD submit from re-logging their time.
    const [entries, setEntries] = useState<TaskSummaryEntry[]>(() => {
        const prefilled: TaskSummaryEntry[] = [];
        for (const lapse of currentSessionAssigned) {
            if (!lapse.assignedTaskId) continue;
            const task = allTasks.find(t => t._id === lapse.assignedTaskId);
            if (!task) continue;
            const lapseMinutes = Math.max(1, Math.round(lapse.seconds / 60));
            const existing = prefilled.find(e => e.task._id === task._id);
            if (existing) {
                existing.allocatedMinutes += lapseMinutes;
            } else {
                prefilled.push({
                    task,
                    allocatedMinutes: lapseMinutes,
                    status: 'completed',
                    priority: task.priority || 'medium',
                    deadline: task.deadline
                        ? (() => { const d = new Date(task.deadline); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); })()
                        : '',
                    projectId: lapse.assignedProjectId || task._projectId || '',
                    notes: lapse.note || `Lapse — ${formatElapsed(lapse.seconds)}`,
                    lapseLogged: true,
                });
            }
        }
        return prefilled;
    });
    
    const [meetingEntries, setMeetingEntries] = useState<MeetingSummaryEntry[]>(() => {
        const prefilled: MeetingSummaryEntry[] = [];
        // Only auto-prefill meetings on first session of the day
        if (!lastEndedAccumulated) {
            for (const meeting of todayMeetings) {
                const myParticipant = meeting.participants?.find((p: any) => p.userId && (p.userId === currentUserId || p.userId._id === currentUserId));
                if (myParticipant?.actualDuration && myParticipant.actualDuration > 0) {
                    prefilled.push({ meeting, allocatedMinutes: myParticipant.actualDuration });
                }
            }
        }
        return prefilled;
    });
    
    const [search, setSearch] = useState('');
    const [confirmAction, setConfirmAction] = useState<'perfect' | 'less' | null>(null);
    // lapseId → taskId of local assignments made inside the EOD modal
    const [lapseAssignments, setLapseAssignments] = useState<Record<string, string>>({});

    // Total day logged metrics (shows whole day time)
    const totalTimerMinutes = Math.round(timerSeconds / 60);
    const totalBreakMinutes = Math.round(breakSeconds / 60);
    const totalWorkingSeconds = Math.max(0, timerSeconds - breakSeconds);
    const totalWorkingMinutes = Math.round(totalWorkingSeconds / 60);

    // If day was ended once earlier on same day, only allocate the second time recorded
    const lastEndedWorkingSeconds = Math.max(0, lastEndedAccumulated - lastEndedBreakAccumulated);
    const secondTimeRecordedSeconds = lastEndedAccumulated > 0
        ? Math.max(0, totalWorkingSeconds - lastEndedWorkingSeconds)
        : totalWorkingSeconds;

    // unassignedLapseMinutes / totalLapseMinutes available for future use:
    //   unassignedLapseMinutes = pendingLapses.reduce((acc, l) => acc + Math.max(1, Math.round(l.seconds / 60)), 0)
    //   totalLapseMinutes = alreadyAssignedLapseMinutes + unassignedLapseMinutes

    // Total minutes available for this EOD session (full working time, no lapse deduction from budget).
    // Lapse-logged minutes are part of the working day — they count as pre-allocated, not removed from budget.
    const rawMinutesToAllocate = lastEndedAccumulated > 0
        ? (secondTimeRecordedSeconds >= 30 ? Math.round(secondTimeRecordedSeconds / 60) : (secondTimeRecordedSeconds > 0 ? 1 : 0))
        : totalWorkingMinutes;

    // minutesToAllocate is the actual working time for this EOD session.
    // Lapse time is counted as pre-allocated WITHIN this budget — not additive to it.
    // If lapse minutes slightly exceed working minutes due to rounding, unallocatedMinutes
    // will go negative and be clamped to 0 at submit (effectiveUnallocated = Math.max(0, ...)).
    const minutesToAllocate = rawMinutesToAllocate;

    // Map of taskId -> total lapse minutes in currentSessionAssigned
    const taskLapseMinutesMap = useMemo(() => {
        const map: Record<string, number> = {};
        for (const lapse of currentSessionAssigned) {
            if (!lapse.assignedTaskId) continue;
            const mins = Math.max(1, Math.round(lapse.seconds / 60));
            map[lapse.assignedTaskId] = (map[lapse.assignedTaskId] || 0) + mins;
        }
        return map;
    }, [currentSessionAssigned]);

    // Count ALL allocated minutes (including lapse-logged tasks — they are pre-allocated portions of the budget).
    // This ensures the budget always balances: lapse time + manually-allocated time = total working time.
    const allocatedTaskMinutes = entries.reduce((acc, e) => {
        return acc + Math.max(0, e.allocatedMinutes || 0);
    }, 0);
    const allocatedMeetingMinutes = meetingEntries.reduce((acc, e) => acc + (e.allocatedMinutes || 0), 0);
    const allocatedTotal = allocatedTaskMinutes + allocatedMeetingMinutes;
    // Unallocated time is against the total working time budget
    const unallocatedMinutes = minutesToAllocate - allocatedTotal;

    const isToday = (dateVal?: string | Date) => {
        if (!dateVal) return false;
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return false;
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    const todayTasks = useMemo(() => {
        return allTasks.filter(t => {
            if (t.status !== 'completed') return true;
            return isToday(t.completedAt) || isToday(t.updatedAt);
        });
    }, [allTasks]);
    
    const displayTasks = useMemo(() => {
        if (search.trim()) {
            const q = search.toLowerCase();
            return allTasks.filter(t => t.title.toLowerCase().includes(q) || (t._projectName || '').toLowerCase().includes(q));
        }

        const tasks = [...todayTasks];
        entries.forEach(e => {
            if (!tasks.some(t => t._id === e.task._id)) {
                tasks.push(e.task);
            }
        });
        return tasks;
    }, [todayTasks, allTasks, entries, search]);


    const toggleTask = (task: GlobalTask) => {
        setEntries(prev => {
            const exists = prev.find(e => e.task._id === task._id);
            if (exists) {
                return prev.filter(e => e.task._id !== task._id);
            } else {
                const taskLapseMins = taskLapseMinutesMap[task._id] || 0;
                return [...prev, {
                    task,
                    allocatedMinutes: taskLapseMins,
                    status: 'completed',
                    priority: task.priority || 'medium',
                    deadline: task.deadline
                        ? (() => {
                            const d = new Date(task.deadline);
                            return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
                        })()
                        : '',
                    projectId: task._projectId || '',
                    notes: taskLapseMins > 0 ? `Lapse — ${formatHrsMins(taskLapseMins)}` : '',
                    lapseLogged: taskLapseMins > 0,
                }];
            }
        });
    };

    const updateEntry = <K extends keyof Omit<TaskSummaryEntry, 'task'>>(taskId: string, field: K, value: TaskSummaryEntry[K]) => {
        setEntries(prev => prev.map(e =>
            e.task._id === taskId
                ? { ...e, [field]: value }
                : e
        ));
    };

    const assignLapseToTask = (lapseId: string, lapseSeconds: number, taskId: string) => {
        const task = allTasks.find(t => t._id === taskId);
        if (!task) return;
        const lapseMinutes = Math.max(1, Math.round(lapseSeconds / 60));
        setLapseAssignments(prev => ({ ...prev, [lapseId]: taskId }));
        if (onAssignLapse) {
            onAssignLapse(lapseId, taskId, task._projectId || '', `Lapse — ${formatElapsed(lapseSeconds)}`);
        }
        setEntries(prev => {
            const exists = prev.find(e => e.task._id === taskId);
            if (exists) {
                // Keep lapseLogged true and ensure allocated minutes covers the lapse
                return prev.map(e => e.task._id === taskId
                    ? {
                        ...e,
                        allocatedMinutes: Math.max(e.allocatedMinutes || 0, lapseMinutes),
                        status: 'completed',
                        lapseLogged: true,
                    }
                    : e
                );
            }
            return [...prev, {
                task,
                allocatedMinutes: lapseMinutes,
                status: 'completed',
                priority: task.priority || 'medium',
                deadline: task.deadline
                    ? (() => { const d = new Date(task.deadline); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); })()
                    : '',
                projectId: task._projectId || '',
                notes: `Lapse — ${formatElapsed(lapseSeconds)}`,
                lapseLogged: true,
            }];
        });
    };

    const unassignLapseFromTask = (lapseId: string, lapseSeconds: number) => {
        const taskId = lapseAssignments[lapseId];
        if (!taskId) return;
        let lapseMinutes = Math.max(1, Math.round(lapseSeconds / 60));
        const currentRemaining = minutesToAllocate - allocatedTotal;
        if (currentRemaining > 0 && lapseMinutes === currentRemaining + 1) {
            lapseMinutes = currentRemaining;
        }
        setLapseAssignments(prev => { const n = { ...prev }; delete n[lapseId]; return n; });
        if (onAssignLapse) {
            onAssignLapse(lapseId, '', '');
        }
        setEntries(prev => prev
            .map(e => e.task._id === taskId
                ? { ...e, allocatedMinutes: Math.max(0, (e.allocatedMinutes || 0) - lapseMinutes) }
                : e
            )
            .filter(e => e.task._id !== taskId || e.allocatedMinutes > 0 || prev.find(p => p.task._id === taskId)?.notes !== `Lapse — ${formatElapsed(lapseSeconds)}`)
        );
    };

    const toggleMeeting = (meeting: GlobalMeeting) => {
        setMeetingEntries(prev => {
            const exists = prev.find(e => e.meeting._id === meeting._id);
            if (exists) {
                return prev.filter(e => e.meeting._id !== meeting._id);
            } else {
                const myParticipant = meeting.participants?.find((p: any) => p.userId && (p.userId === currentUserId || p.userId._id === currentUserId));
                const duration = myParticipant?.actualDuration ?? (meeting as any).actualDuration ?? meeting.duration ?? 0;
                return [...prev, { meeting, allocatedMinutes: duration }];
            }
        });
    };

    const updateMeetingMinutes = (meetingId: string, minutes: number) => {
        setMeetingEntries(prev => prev.map(e =>
            e.meeting._id === meetingId
                ? { ...e, allocatedMinutes: minutes }
                : e
        ));
    };

    const handleSubmit = async () => {
        if (entries.length === 0 && meetingEntries.length === 0) {
            toast.error('Please select at least one task or meeting.');
            return;
        }
        // Allow up to 2 min negative — lapse rounding (Math.max(1, Math.round)) can create small drift
        const effectiveUnallocated = unallocatedMinutes < 0 && unallocatedMinutes >= -2 ? 0 : unallocatedMinutes;
        if (effectiveUnallocated < 0) {
            toast.error(`Cannot exceed time to allocate (${formatHrsMins(minutesToAllocate)}). Please reduce allocated time by ${Math.abs(unallocatedMinutes)} min.`);
            return;
        }

        // Validate task mandatory fields (everything mandatory except due date and notes)
        for (const entry of entries) {
            const taskLapseMins = taskLapseMinutesMap[entry.task._id] || 0;
            const isLapse = entry.lapseLogged || taskLapseMins > 0;
            // Skip time check for lapse-logged tasks — time was already logged during the day
            if (!isLapse && (!entry.allocatedMinutes || entry.allocatedMinutes <= 0 || isNaN(entry.allocatedMinutes))) {
                toast.error(`Please allocate at least 1 minute for task: "${entry.task.title}"`);
                return;
            }
            // Project is only required for project tasks, not individual tasks
            if (entry.task._projectId && !entry.projectId) {
                toast.error(`Project is missing for task: "${entry.task.title}"`);
                return;
            }
            if (!entry.status) {
                toast.error(`Status is missing for task: "${entry.task.title}"`);
                return;
            }
            if (!entry.priority) {
                toast.error(`Priority is missing for task: "${entry.task.title}"`);
                return;
            }
        }

        // Validate meeting mandatory fields
        for (const mEntry of meetingEntries) {
            if (!mEntry.allocatedMinutes || mEntry.allocatedMinutes <= 0 || isNaN(mEntry.allocatedMinutes)) {
                toast.error(`Please allocate at least 1 minute for meeting: "${mEntry.meeting.title}"`);
                return;
            }
        }

        if (effectiveUnallocated === 0) {
            setConfirmAction('perfect');
            return;
        } else if (effectiveUnallocated > 0) {
            setConfirmAction('less');
            return;
        }

        await executeSubmit();
    };

    const executeSubmit = async () => {
        setIsSubmitting(true);
        try {
            const effectiveUnallocated = Math.max(0, unallocatedMinutes);
            await onSubmit(entries, meetingEntries, effectiveUnallocated);
            onClose();
        } finally {
            setIsSubmitting(false);
            setConfirmAction(null);
        }
    };

    const inputStyle = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    const formatMeetingTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch { return iso; }
    };

    const formatHrsMins = (mins: number) => {
        const absMins = Math.abs(mins);
        const h = Math.floor(absMins / 60);
        const m = absMins % 60;
        const formatted = h > 0 ? `${h}h ${m}m` : `${m} min`;
        return mins < 0 ? `Over by ${formatted}` : formatted;
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
            <div
                className="relative w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    maxHeight: '90vh',
                    border: '1px solid var(--color-border-default)',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            <Clock size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                                End of Day Summary
                            </h2>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                Distribute your logged time across tasks and meetings
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                    
                    {/* Top Timer Summary — Shows whole logged day time, gives only second time recorded to allocate */}
                    <div
                        className="rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}
                    >
                        {/* Total On-Clock */}
                        <div>
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Total On-Clock</p>
                            <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                                {formatElapsed(timerSeconds)}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {totalTimerMinutes} total minutes
                            </p>
                        </div>

                        {/* Break Time */}
                        <div className="sm:border-l sm:pl-4" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <p className="text-xs font-semibold text-amber-600">Break Time</p>
                            </div>
                            <p className="text-xl font-bold font-mono text-amber-700">
                                {formatElapsed(breakSeconds)}
                            </p>
                            <p className="text-[11px] mt-0.5 text-amber-600/80">
                                {totalBreakMinutes} min break
                            </p>
                        </div>

                        {/* Working Time */}
                        <div className="lg:border-l lg:pl-4" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }}></span>
                                <p className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Working Time</p>
                            </div>
                            <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                                {formatElapsed(totalWorkingSeconds)}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {minutesToAllocate} min to allocate
                                {alreadyAssignedLapseMinutes > 0 && (
                                    <span className="ml-1 text-emerald-600 font-semibold">
                                        ({alreadyAssignedLapseMinutes}m via lapse ✓)
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* Unallocated Time */}
                        <div className="text-right sm:border-l sm:pl-4" style={{ borderColor: 'var(--color-border-default)' }}>
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Unallocated Time</p>
                            {(() => {
                                const displayUnallocated = unallocatedMinutes === -1 ? 0 : unallocatedMinutes;
                                return (
                                    <p className={`text-xl font-bold font-mono ${displayUnallocated < 0 ? 'text-red-500' : ''}`} style={{ color: displayUnallocated === 0 ? 'var(--color-success)' : displayUnallocated > 0 ? 'var(--color-text-primary)' : undefined }}>
                                        {formatHrsMins(displayUnallocated)}
                                    </p>
                                );
                            })()}
                            <div className="flex items-center justify-end gap-1 text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                <span>Tasks: {formatHrsMins(allocatedTaskMinutes)}</span>
                                <span>·</span>
                                <span>Mtgs: {formatHrsMins(allocatedMeetingMinutes)}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Already-assigned Lapses (logged during the day) ── */}
                    {assignedLapses.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                    Already Logged via Lapse
                                </label>
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                    style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                                >
                                    {alreadyAssignedLapseMinutes} min deducted
                                </span>
                            </div>
                            <div
                                className="rounded-xl overflow-hidden"
                                style={{ border: '1px solid #BBF7D0' }}
                            >
                                {assignedLapses.map((lapse, idx) => {
                                    const task = allTasks.find(t => t._id === lapse.assignedTaskId);
                                    const lapseMinutes = Math.max(1, Math.round(lapse.seconds / 60));
                                    const timeStr = new Date(lapse.capturedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                                    return (
                                        <div
                                            key={lapse.id}
                                            className="px-3 py-2 flex items-center justify-between"
                                            style={{
                                                backgroundColor: '#F0FDF4',
                                                borderBottom: idx < assignedLapses.length - 1 ? '1px solid #BBF7D0' : undefined,
                                            }}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <CheckCircle2 size={12} style={{ color: '#16A34A', flexShrink: 0 }} />
                                                <span className="text-xs truncate" style={{ color: '#166534' }}>
                                                    {task?.title || 'Unknown task'}
                                                    {task?._projectName ? ` · ${task._projectName}` : ''}
                                                </span>
                                                <span className="text-[10px] shrink-0" style={{ color: '#4ADE80' }}>· {timeStr}</span>
                                            </div>
                                            <span className="font-mono text-xs font-bold ml-2 shrink-0" style={{ color: '#166534' }}>
                                                {lapseMinutes}m logged ✓
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Unassigned Lapses Section ── */}
                    {pendingLapses.length > 0 && (() => {
                        const stillUnassigned = pendingLapses.filter(l => !lapseAssignments[l.id]);
                        return (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <LapIcon size={14} style={{ color: 'var(--color-primary)' }} />
                                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                    Unassigned Lapses
                                </label>
                                {stillUnassigned.length > 0 && (
                                    <span
                                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                        style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
                                    >
                                        {stillUnassigned.length}
                                    </span>
                                )}
                                {stillUnassigned.length === 0 && (
                                    <span
                                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                        style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                                    >
                                        All assigned ✓
                                    </span>
                                )}
                            </div>
                            <div
                                className="rounded-xl overflow-hidden"
                                style={{ border: '1px solid var(--color-border-default)' }}
                            >
                                {pendingLapses.map((lapse, idx) => {
                                    const capturedAt = new Date(lapse.capturedAt);
                                    const timeStr = capturedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                                    const assignedTaskId = lapseAssignments[lapse.id];
                                    const assignedTask = assignedTaskId ? allTasks.find(t => t._id === assignedTaskId) : null;
                                    const lapseMinutes = Math.max(1, Math.round(lapse.seconds / 60));
                                    return (
                                        <div
                                            key={lapse.id}
                                            className="p-3 space-y-2"
                                            style={{
                                                backgroundColor: assignedTask ? '#F0FDF4' : 'var(--color-bg-subtle)',
                                                borderBottom: idx < pendingLapses.length - 1 ? '1px solid var(--color-border-default)' : undefined,
                                            }}
                                        >
                                            {/* Row header */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    {assignedTask ? (
                                                        <CheckCircle2 size={13} style={{ color: '#16A34A' }} />
                                                    ) : (
                                                        <span className="w-3 h-3 rounded-full border-2" style={{ borderColor: 'var(--color-border-default)' }} />
                                                    )}
                                                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                        Lapse #{idx + 1} · {timeStr}
                                                    </span>
                                                </div>
                                                <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                                    {formatElapsed(lapse.seconds)}
                                                    <span className="font-normal text-[10px] ml-1" style={{ color: 'var(--color-text-muted)' }}>≈ {lapseMinutes}m</span>
                                                </span>
                                            </div>

                                            {/* Task selector */}
                                            {assignedTask ? (
                                                <div className="flex items-center justify-between pl-4">
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        <span className="text-xs truncate" style={{ color: '#16A34A' }}>
                                                            → {assignedTask.title}
                                                            {assignedTask._projectName ? ` · ${assignedTask._projectName}` : ''}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => unassignLapseFromTask(lapse.id, lapse.seconds)}
                                                        className="text-[11px] ml-2 shrink-0 hover:underline"
                                                        style={{ color: 'var(--color-text-muted)' }}
                                                    >
                                                        change
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="pl-4">
                                                    <select
                                                        defaultValue=""
                                                        onChange={e => {
                                                            if (e.target.value) assignLapseToTask(lapse.id, lapse.seconds, e.target.value);
                                                        }}
                                                        className="w-full text-xs rounded-lg border outline-none px-2 py-1.5"
                                                        style={{
                                                            borderColor: 'var(--color-border-default)',
                                                            backgroundColor: 'var(--color-bg-surface)',
                                                            color: 'var(--color-text-primary)',
                                                        }}
                                                    >
                                                        <option value="">— Assign {lapseMinutes}m to a task…</option>
                                                        {allTasks
                                                            .filter(t => t.status !== 'completed')
                                                            .map(t => (
                                                                <option key={t._id} value={t._id}>
                                                                    {t.title}{t._projectName ? ` · ${t._projectName}` : ''}
                                                                </option>
                                                            ))
                                                        }
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Total row */}
                                <div
                                    className="px-3 py-2 flex items-center justify-between"
                                    style={{ backgroundColor: 'var(--color-bg-subtle)', borderTop: '1px solid var(--color-border-default)' }}
                                >
                                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                                        {stillUnassigned.length > 0
                                            ? `${stillUnassigned.length} lapse${stillUnassigned.length > 1 ? 's' : ''} still unassigned`
                                            : 'All lapses assigned'}
                                    </span>
                                    <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-primary)' }}>
                                        {formatElapsed(pendingLapses.reduce((acc, l) => acc + l.seconds, 0))}
                                    </span>
                                </div>
                            </div>
                        </div>
                        );
                    })()}

                    {/* ── Today's Meetings Section ── */}
                    {todayMeetings.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Video size={14} style={{ color: 'var(--color-primary)' }} />
                                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                    Today&rsquo;s Meetings — allocate time
                                </label>
                            </div>

                            <div className="space-y-2">
                                {todayMeetings.map(meeting => {
                                    const mEntry = meetingEntries.find(e => e.meeting._id === meeting._id);
                                    const isChecked = !!mEntry;
                                    return (
                                        <div
                                            key={meeting._id}
                                            className="rounded-xl border overflow-hidden transition-all"
                                            style={{
                                                borderColor: isChecked ? 'var(--color-primary)' : 'var(--color-border-default)',
                                                backgroundColor: 'var(--color-bg-surface)',
                                            }}
                                        >
                                            <div
                                                className="flex items-center gap-3 p-3 cursor-pointer"
                                                onClick={() => toggleMeeting(meeting)}
                                                style={{ backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}
                                            >
                                                <div
                                                    className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                                                    style={{
                                                        backgroundColor: isChecked ? 'var(--color-primary)' : 'transparent',
                                                        borderColor: isChecked ? 'var(--color-primary)' : 'var(--color-border-default)',
                                                    }}
                                                >
                                                    {isChecked && <CheckCircle2 size={14} style={{ color: '#fff' }} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                                            {meeting.title}
                                                        </p>
                                                        <span
                                                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                                                            style={{
                                                                backgroundColor: meeting.type === 'external' ? '#FEF3C7' : '#EFF6FF',
                                                                color: meeting.type === 'external' ? '#92400E' : '#1D4ED8',
                                                            }}
                                                        >
                                                            {meeting.type === 'internal' ? '🏢 Internal' : '🌐 External'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <Calendar size={11} style={{ color: 'var(--color-text-muted)' }} />
                                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                            {formatMeetingTime(meeting.scheduledAt)} · {meeting._projectName}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {isChecked && mEntry && (
                                                <div className="px-4 pb-3 pt-2 border-t border-dashed" style={{ borderColor: 'var(--color-border-default)' }}>
                                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                                        Time Spent <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="flex items-center gap-2 w-48">
                                                        <div className="relative flex-1">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={Math.floor((mEntry.allocatedMinutes || 0) / 60) || ''}
                                                                onChange={e => {
                                                                    const h = parseInt(e.target.value) || 0;
                                                                    const m = (mEntry.allocatedMinutes || 0) % 60;
                                                                    updateMeetingMinutes(meeting._id, h * 60 + m);
                                                                }}
                                                                onClick={ev => ev.stopPropagation()}
                                                                placeholder="Hrs"
                                                                className="w-full px-2.5 py-2 rounded-lg border text-xs outline-none"
                                                                style={inputStyle}
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">h</span>
                                                        </div>
                                                        <div className="relative flex-1">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={59}
                                                                value={(mEntry.allocatedMinutes || 0) % 60 || ''}
                                                                onChange={e => {
                                                                    const h = Math.floor((mEntry.allocatedMinutes || 0) / 60);
                                                                    const m = parseInt(e.target.value) || 0;
                                                                    updateMeetingMinutes(meeting._id, h * 60 + m);
                                                                }}
                                                                onClick={ev => ev.stopPropagation()}
                                                                placeholder="Min"
                                                                className="w-full px-2.5 py-2 rounded-lg border text-xs outline-none"
                                                                style={inputStyle}
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">m</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Tasks Section ── */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock size={14} style={{ color: 'var(--color-primary)' }} />
                                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                    Tasks you worked on
                                </label>
                            </div>
                        </div>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by task title or project..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                                style={inputStyle}
                            />
                        </div>

                        {displayTasks.length === 0 && (
                            <div className="text-center py-6 border rounded-xl" style={{ borderColor: 'var(--color-border-default)', borderStyle: 'dashed' }}>
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No tasks found.</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {displayTasks.map(task => {
                                const entry = entries.find(e => e.task._id === task._id);
                                const isChecked = !!entry;
                                const taskLapseMins = taskLapseMinutesMap[task._id] || 0;
                                const isLapseLogged = !!entry?.lapseLogged || taskLapseMins > 0;
                                const extraMinutes = Math.max(0, (entry?.allocatedMinutes || 0) - taskLapseMins);
                                // Lapse tasks already have time logged — don't show "no time" warning for them
                                const hasNoTime = isChecked && !isLapseLogged && (!entry.allocatedMinutes || entry.allocatedMinutes <= 0);
                                // Project is only required for project tasks, not individual tasks
                                const isIndividualTask = !task._projectId;
                                const isMissingDetails = isChecked && !isIndividualTask && !entry.projectId;

                                return (
                                    <div
                                        key={task._id}
                                        className="rounded-xl border overflow-hidden transition-all"
                                        style={{
                                            borderColor: isChecked 
                                                ? (hasNoTime ? '#F59E0B' : 'var(--color-primary)') 
                                                : 'var(--color-border-default)', 
                                            backgroundColor: 'var(--color-bg-surface)' 
                                        }}
                                    >
                                        <div
                                            className="relative flex items-center gap-3 p-3 pb-6 cursor-pointer hover:bg-black/5"
                                            onClick={() => toggleTask(task)}
                                            style={{ backgroundColor: isChecked ? (hasNoTime ? 'rgba(245, 158, 11, 0.04)' : 'rgba(16, 185, 129, 0.05)') : 'transparent' }}
                                        >
                                            <div
                                                className="w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0"
                                                style={{
                                                    backgroundColor: isChecked ? (hasNoTime ? '#F59E0B' : 'var(--color-primary)') : 'transparent',
                                                    borderColor: isChecked ? (hasNoTime ? '#F59E0B' : 'var(--color-primary)') : 'var(--color-border-default)',
                                                }}
                                            >
                                                {isChecked && <CheckCircle2 size={14} style={{ color: '#fff' }} />}
                                            </div>
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className={`text-sm font-semibold truncate ${task.status === 'completed' ? 'line-through opacity-70' : ''}`} style={{ color: 'var(--color-text-primary)' }}>{task.title}</p>
                                                    {task.status === 'completed' && (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                                                            Completed
                                                        </span>
                                                    )}
                                                    {isLapseLogged && (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                            ✓ {taskLapseMins > 0 ? `${taskLapseMins}m lapse logged` : 'Lapse logged'}
                                                        </span>
                                                    )}
                                                    {isChecked && extraMinutes > 0 && (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
                                                            {formatHrsMins(extraMinutes)} assigned
                                                        </span>
                                                    )}
                                                    {isChecked && hasNoTime && (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                                                            Time not assigned
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{task._projectName || 'No Project'}</p>
                                            </div>
                                            <div className="absolute bottom-2 right-3 flex items-center gap-2.5">
                                                {hasNoTime && (
                                                    <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                                                        <Clock size={11} />
                                                        *Time not assigned
                                                    </span>
                                                )}
                                                {isMissingDetails && (
                                                    <span className="text-xs font-semibold text-red-500">
                                                        *Missing details
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {isChecked && entry && (
                                            <div className="p-4 border-t border-dashed bg-black/[0.02]" style={{ borderColor: 'var(--color-border-default)' }}>
                                                {/* Row 1: Time & Status & Project */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                                Time Spent <span className="text-red-500">*</span>
                                                            </label>
                                                            {hasNoTime && (
                                                                <span className="text-[10px] font-semibold text-red-500">
                                                                    *Required
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    value={Math.floor((entry.allocatedMinutes || 0) / 60) || ''}
                                                                    onChange={e => {
                                                                        const h = parseInt(e.target.value) || 0;
                                                                        const m = (entry.allocatedMinutes || 0) % 60;
                                                                        const total = h * 60 + m;
                                                                        updateEntry(entry.task._id, 'allocatedMinutes', total);
                                                                        if (total > 0 && entry.status !== 'completed') {
                                                                            updateEntry(entry.task._id, 'status', 'completed');
                                                                        }
                                                                    }}
                                                                    placeholder="Hrs"
                                                                    className="w-full px-2.5 py-2 rounded-lg border text-xs outline-none"
                                                                    style={inputStyle}
                                                                />
                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">h</span>
                                                            </div>
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={59}
                                                                    value={(entry.allocatedMinutes || 0) % 60 || ''}
                                                                    onChange={e => {
                                                                        const h = Math.floor((entry.allocatedMinutes || 0) / 60);
                                                                        const m = parseInt(e.target.value) || 0;
                                                                        const total = h * 60 + m;
                                                                        updateEntry(entry.task._id, 'allocatedMinutes', total);
                                                                        if (total > 0 && entry.status !== 'completed') {
                                                                            updateEntry(entry.task._id, 'status', 'completed');
                                                                        }
                                                                    }}
                                                                    placeholder="Min"
                                                                    className="w-full px-2.5 py-2 rounded-lg border text-xs outline-none"
                                                                    style={inputStyle}
                                                                />
                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">m</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                                            Update Status <span className="text-red-500">*</span>
                                                        </label>
                                                        <select
                                                            value={entry.status}
                                                            onChange={e => updateEntry(entry.task._id, 'status', e.target.value as GlobalTask['status'])}
                                                            className="w-full px-3 py-2 rounded-lg border text-xs outline-none"
                                                            style={inputStyle}
                                                        >
                                                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                                            Project {!!entry.task._projectId && <span className="text-red-500">*</span>}
                                                            {!entry.task._projectId && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> (optional)</span>}
                                                        </label>
                                                        <select
                                                            value={entry.projectId}
                                                            onChange={e => updateEntry(entry.task._id, 'projectId', e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border text-xs outline-none"
                                                            style={inputStyle}
                                                        >
                                                            <option value="">Select a project...</option>
                                                            {projects.map(p => (
                                                                <option key={p._id} value={p._id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Row 2: Priority & Deadline */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                                            Priority <span className="text-red-500">*</span>
                                                        </label>
                                                        <select
                                                            value={entry.priority}
                                                            onChange={e => updateEntry(entry.task._id, 'priority', e.target.value as GlobalTask['priority'])}
                                                            className="w-full px-3 py-2 rounded-lg border text-xs outline-none"
                                                            style={inputStyle}
                                                        >
                                                            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                                            Due Date
                                                        </label>
                                                        <input
                                                            type="date"
                                                            value={entry.deadline}
                                                            onChange={e => updateEntry(entry.task._id, 'deadline', e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border text-xs outline-none"
                                                            style={inputStyle}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Notes */}
                                                <div>
                                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                                        Notes / What was done
                                                    </label>
                                                    <textarea
                                                        value={entry.notes}
                                                        onChange={e => updateEntry(entry.task._id, 'notes', e.target.value)}
                                                        placeholder="What did you accomplish? (Optional)"
                                                        rows={2}
                                                        className="w-full px-3 py-2 rounded-lg border text-xs outline-none resize-none"
                                                        style={inputStyle}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-t shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-black/5"
                            style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}
                        >
                            Cancel
                        </button>
                        {onAddNewTask && (
                            <button
                                onClick={onAddNewTask}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90 active:scale-95 shadow-sm border"
                                style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)', backgroundColor: 'transparent' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Add Task
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Save &amp; End Day
                    </button>
                </div>
            </div>

            {/* Confirmation Modals */}
            {confirmAction && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                            {confirmAction === 'perfect' ? 'Submit Timesheet?' : 'End Day with Less Time?'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-6">
                            {confirmAction === 'perfect' 
                                ? 'You have perfectly allocated your time. Are you ready to save your tasks and submit?' 
                                : `You have allocated ${formatHrsMins(allocatedTotal)}, which is less than your working time of ${formatHrsMins(minutesToAllocate)}. Unallocated time will be saved as "Unallocated". Are you sure you want to proceed?`}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeSubmit}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Confirm & Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
