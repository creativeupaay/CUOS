import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Search, Loader2, Archive, CheckCheck } from 'lucide-react';
import { LapIcon } from '@/components/atoms/LapIcon';
import { formatElapsed } from '@/hooks/useTaskTimer';
import { useGlobalTasks, type GlobalTask } from '@/hooks/useGlobalTasks';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LapseModalProps {
    lapseSeconds: number;
    onAssign: (taskId: string, projectId: string, markComplete: boolean, note: string) => Promise<void>;
    onKeepUnassigned: () => void;
    onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
    low:      '#10B981',
    medium:   '#F59E0B',
    high:     '#EF4444',
    critical: '#7C3AED',
};

const STATUS_LABEL: Record<string, string> = {
    'in-progress': 'In Progress',
    'todo':        'To Do',
    'paused':      'Paused',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LapseModal({ lapseSeconds, onAssign, onKeepUnassigned, onClose }: LapseModalProps) {
    const { allTasks, currentUserId, updateTask } = useGlobalTasks();
    const [search, setSearch] = useState('');
    const [selectedTask, setSelectedTask] = useState<GlobalTask | null>(null);
    const [markComplete, setMarkComplete] = useState(true);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [visible, setVisible] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Slide-in animation
    useEffect(() => {
        const id = window.setTimeout(() => setVisible(true), 12);
        return () => window.clearTimeout(id);
    }, []);

    useEffect(() => {
        if (visible) window.setTimeout(() => searchRef.current?.focus(), 80);
    }, [visible]);

    const handleClose = () => {
        setVisible(false);
        window.setTimeout(onClose, 260);
    };

    // Helper to extract entity ID (mirrors DailyTodosBoard logic)
    const getEntityId = (value: unknown): string => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
            const obj = value as Record<string, unknown>;
            return String(obj._id ?? obj.id ?? '');
        }
        return String(value);
    };

    // Only EOD-visible tasks: non-completed tasks that belong to the current user
    // (same ownership filter as DailyTodosBoard). Keep currently selected task visible even if marked completed.
    const activeTasks = useMemo(() =>
        [...allTasks]
            .filter(t => {
                if (t.status === 'completed' && selectedTask?._id !== t._id) return false;

                const isAssigned = Array.isArray(t.assignees) &&
                    t.assignees.some(a => getEntityId(a) === currentUserId);
                if (isAssigned) return true;

                const isCreator = getEntityId(t.createdBy) === currentUserId;
                const hasOtherAssignees = Array.isArray(t.assignees) && t.assignees.length > 0;
                return isCreator && !hasOtherAssignees;
            })
            .sort((a, b) => {
                const order: Record<string, number> = { 'in-progress': 0, 'todo': 1, 'paused': 2, 'completed': 3 };
                return (order[a.status] ?? 9) - (order[b.status] ?? 9);
            }),
        [allTasks, currentUserId, selectedTask?._id]
    );

    const displayTasks = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return activeTasks;
        return activeTasks.filter(t =>
            t.title.toLowerCase().includes(q) ||
            (t._projectName || '').toLowerCase().includes(q)
        );
    }, [activeTasks, search]);

    const handleSelectTask = (task: GlobalTask) => {
        if (selectedTask?._id === task._id) {
            setSelectedTask(null);
            return;
        }
        setSelectedTask(task);
        if (markComplete) {
            // Move task to completed immediately ("then and there")
            updateTask(task._projectId, task._id, { status: 'completed' });
        }
    };

    const handleToggleComplete = () => {
        const nextVal = !markComplete;
        setMarkComplete(nextVal);
        if (selectedTask) {
            const nextStatus = nextVal ? 'completed' : 'in-progress';
            updateTask(selectedTask._projectId, selectedTask._id, { status: nextStatus });
        }
    };

    const handleAssign = async () => {
        if (!selectedTask) return;
        setIsSubmitting(true);
        try {
            await onAssign(selectedTask._id, selectedTask._projectId || '', markComplete, note);
        } catch {
            toast.error('Failed to assign lapse time.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeepUnassigned = () => {
        setVisible(false);
        window.setTimeout(onKeepUnassigned, 260);
    };

    const lapseMinutes = Math.max(1, Math.round(lapseSeconds / 60));

    const inputStyle: React.CSSProperties = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return createPortal(
        <div
            className={`fixed inset-0 z-[600] flex items-center justify-center p-4 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
            <div
                className={`relative w-full max-w-lg rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-3'}`}
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    maxHeight: '86vh',
                }}
            >
                {/* ── Header ── */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            <LapIcon size={18} className="text-white" />
                        </div>
                        <div>
                            <h2
                                className="text-base font-bold"
                                style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}
                            >
                                Lapse — Assign Time
                            </h2>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                Assign{' '}
                                <span className="font-semibold font-mono" style={{ color: 'var(--color-primary)' }}>
                                    {formatElapsed(lapseSeconds)}
                                </span>
                                {' '}to a task or keep it for end of day
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── Lapse duration summary bar ── */}
                <div
                    className="mx-6 mt-4 rounded-xl px-4 py-3 flex items-center justify-between shrink-0"
                    style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Net Work Time</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                            {formatElapsed(lapseSeconds)}
                        </p>
                        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                            ≈ {lapseMinutes} min
                        </span>
                    </div>
                </div>

                {/* ── Task search ── */}
                <div className="px-6 pt-4 shrink-0">
                    <label
                        className="block text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Pick a task to assign time to
                    </label>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by task title or project…"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* ── Task list ── */}
                <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5 min-h-0">
                    {displayTasks.length === 0 && (
                        <div
                            className="flex flex-col items-center justify-center py-8 text-center rounded-xl border"
                            style={{ borderColor: 'var(--color-border-default)', borderStyle: 'dashed' }}
                        >
                            <Archive size={20} className="mb-2" style={{ color: 'var(--color-text-muted)' }} />
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>No active tasks found</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Keep this lapse unassigned for end of day</p>
                        </div>
                    )}

                    {displayTasks.map(task => {
                        const isSelected = selectedTask?._id === task._id;
                        const dotColor = PRIORITY_COLOR[task.priority] || '#6B7280';
                        return (
                            <button
                                key={task._id}
                                onClick={() => handleSelectTask(task)}
                                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all"
                                style={{
                                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border-default)',
                                    backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'transparent',
                                }}
                            >
                                {/* Checkbox */}
                                <div
                                    className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                                    style={{
                                        borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border-default)',
                                        backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                                    }}
                                >
                                    {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                </div>

                                {/* Priority dot */}
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />

                                {/* Task info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                                        {task.title}
                                    </p>
                                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                                        {task._projectName || 'Individual Task'}
                                        {' · '}
                                        <span style={{
                                            color: (task.status === 'completed' || (isSelected && markComplete))
                                                ? '#16A34A'
                                                : task.status === 'in-progress'
                                                ? 'var(--color-primary)'
                                                : 'var(--color-text-muted)',
                                            fontWeight: (task.status === 'completed' || (isSelected && markComplete)) ? 600 : 400,
                                        }}>
                                            {(task.status === 'completed' || (isSelected && markComplete)) ? 'Completed ✓' : (STATUS_LABEL[task.status] || task.status)}
                                        </span>
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* ── Options panel (shown when task selected) ── */}
                {selectedTask && (
                    <div
                        className="mx-6 mb-2 rounded-xl px-4 py-3 space-y-3 shrink-0"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}
                    >
                        {/* Mark complete toggle */}
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <div
                                className="relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer"
                                style={{ backgroundColor: markComplete ? 'var(--color-primary)' : 'var(--color-border-default)' }}
                                onClick={handleToggleComplete}
                            >
                                <div
                                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                                    style={{ transform: markComplete ? 'translateX(16px)' : 'translateX(2px)' }}
                                />
                            </div>
                            <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                Mark <span className="font-semibold">"{selectedTask.title}"</span> as completed
                            </span>
                        </label>

                        {/* Note */}
                        <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                Note <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="What did you accomplish?"
                                maxLength={200}
                                className="w-full px-3 py-2 rounded-lg border text-xs outline-none"
                                style={inputStyle}
                            />
                        </div>
                    </div>
                )}

                {/* ── Footer ── */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-t shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <button
                        onClick={handleKeepUnassigned}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-black/5"
                        style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}
                    >
                        <Archive size={14} />
                        Keep for end of day
                    </button>

                    <button
                        onClick={handleAssign}
                        disabled={!selectedTask || isSubmitting}
                        className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isSubmitting
                            ? <Loader2 size={14} className="animate-spin" />
                            : <CheckCheck size={14} />
                        }
                        Log {lapseMinutes}m{markComplete ? ' & Complete' : ''}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
