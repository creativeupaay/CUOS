import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, CheckCircle2, Search, Loader2, Video, Calendar } from 'lucide-react';
import type { GlobalTask } from '@/hooks/useGlobalTasks';
import type { GlobalMeeting } from '@/hooks/useGlobalMeetings';
import { formatElapsed } from '@/hooks/useTaskTimer';
import type { Project } from '@/features/project';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskSummaryEntry {
    task: GlobalTask;
    allocatedMinutes: number;
    status: GlobalTask['status'];
    priority: GlobalTask['priority'];
    deadline: string;
    projectId: string;
    notes: string;
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
    onClose: () => void;
    onSubmit: (entries: TaskSummaryEntry[], meetingEntries: MeetingSummaryEntry[], unallocatedMinutes: number) => Promise<void>;
    onAddNewTask?: () => void;
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
    onClose,
    onSubmit,
    onAddNewTask,
}: EndOfDayModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [entries, setEntries] = useState<TaskSummaryEntry[]>([]);
    const [meetingEntries, setMeetingEntries] = useState<MeetingSummaryEntry[]>([]);
    const [search, setSearch] = useState('');
    const [confirmAction, setConfirmAction] = useState<'perfect' | 'less' | null>(null);

    const totalTimerMinutes = Math.floor(timerSeconds / 60);
    const allocatedTaskMinutes = entries.reduce((acc, e) => acc + (e.allocatedMinutes || 0), 0);
    const allocatedMeetingMinutes = meetingEntries.reduce((acc, e) => acc + (e.allocatedMinutes || 0), 0);
    const allocatedTotal = allocatedTaskMinutes + allocatedMeetingMinutes;
    const unallocatedMinutes = totalTimerMinutes - allocatedTotal;

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
                return [...prev, {
                    task,
                    allocatedMinutes: 0,
                    status: task.status === 'todo' ? 'in-progress' : task.status,
                    priority: task.priority || 'medium',
                    deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : '',
                    projectId: task._projectId || '',
                    notes: '',
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

    const toggleMeeting = (meeting: GlobalMeeting) => {
        setMeetingEntries(prev => {
            const exists = prev.find(e => e.meeting._id === meeting._id);
            if (exists) {
                return prev.filter(e => e.meeting._id !== meeting._id);
            } else {
                const duration = (meeting as any).actualDuration || (meeting as any).scheduledDurationMinutes || 0;
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
            import('react-hot-toast').then(toast => toast.default.error('Please select at least one task or meeting.'));
            return;
        }
        if (unallocatedMinutes < 0) {
            import('react-hot-toast').then(toast => {
                toast.default.error(`Cannot exceed total logged time. Please reduce by ${Math.abs(unallocatedMinutes)} min.`);
            });
            return;
        }

        // Validate task mandatory fields
        for (const entry of entries) {
            if (entry.task._projectId && !entry.projectId) {
                import('react-hot-toast').then(toast => toast.default.error(`Project is missing for task: "${entry.task.title}"`));
                return;
            }
            if (!entry.deadline) {
                import('react-hot-toast').then(toast => toast.default.error(`Due Date is missing for task: "${entry.task.title}"`));
                return;
            }
            if (!entry.allocatedMinutes || entry.allocatedMinutes <= 0 || isNaN(entry.allocatedMinutes)) {
                 import('react-hot-toast').then(toast => toast.default.error(`Please allocate at least 1 minute for task: "${entry.task.title}"`));
                 return;
            }
        }

        // Validate meeting mandatory fields
        for (const mEntry of meetingEntries) {
            if (!mEntry.allocatedMinutes || mEntry.allocatedMinutes <= 0 || isNaN(mEntry.allocatedMinutes)) {
                 import('react-hot-toast').then(toast => toast.default.error(`Please allocate at least 1 minute for meeting: "${mEntry.meeting.title}"`));
                 return;
            }
        }

        if (unallocatedMinutes === 0) {
            setConfirmAction('perfect');
            return;
        } else if (unallocatedMinutes > 0) {
            setConfirmAction('less');
            return;
        }

        await executeSubmit();
    };

    const executeSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onSubmit(entries, meetingEntries, unallocatedMinutes);
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
                    
                    {/* Top Timer Summary */}
                    <div
                        className="rounded-xl p-4 flex items-center justify-between"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}
                    >
                        <div>
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-primary)' }}>Total Logged Today</p>
                            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                                {formatElapsed(timerSeconds)}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {totalTimerMinutes} total minutes
                            </p>
                        </div>
                        <div className="text-center flex flex-col gap-1 items-end">
                            <div>
                                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Tasks</p>
                                <p className="text-base font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                                    {formatHrsMins(allocatedTaskMinutes)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Meetings</p>
                                <p className="text-base font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                                    {formatHrsMins(allocatedMeetingMinutes)}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Unallocated Time</p>
                            <p className={`text-xl font-bold font-mono ${unallocatedMinutes < 0 ? 'text-red-500' : ''}`} style={{ color: unallocatedMinutes === 0 ? 'var(--color-success)' : unallocatedMinutes > 0 ? 'var(--color-text-primary)' : undefined }}>
                                {formatHrsMins(unallocatedMinutes)}
                            </p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                {unallocatedMinutes < 0 ? 'Please reduce allocated time' : 'Add tasks/meetings to assign time'}
                            </p>
                        </div>
                    </div>

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
                                const hasNoTime = !entry || !entry.allocatedMinutes || entry.allocatedMinutes <= 0;
                                const isMissingDetails = (!!task._projectId && (!entry || !entry.projectId)) || (!task.deadline && (!entry || !entry.deadline));

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
                                                    {isChecked && (entry.allocatedMinutes > 0) && (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
                                                            {formatHrsMins(entry.allocatedMinutes)} assigned
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
                                                                        updateEntry(entry.task._id, 'allocatedMinutes', h * 60 + m);
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
                                                                        updateEntry(entry.task._id, 'allocatedMinutes', h * 60 + m);
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
                                                            Due Date <span className="text-red-500">*</span>
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
                        disabled={isSubmitting || unallocatedMinutes < 0}
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
                                : `You have allocated ${formatHrsMins(allocatedTotal)}, which is less than your total logged time of ${formatElapsed(timerSeconds)}. Unallocated time will be saved as "Unallocated". Are you sure you want to proceed?`}
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
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
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
