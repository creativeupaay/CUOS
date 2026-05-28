import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Lock, Clock } from 'lucide-react';
import { useUpdateTaskMutation } from '@/features/project';
import type { Task } from '@/features/project';
import { StatusBadge } from '../../StatusBadge';

// Helper inside the module to avoid cyclic dependencies or huge imports
const getEntityId = (value: unknown): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
        const v = value as Record<string, unknown>;
        if (v._id) return getEntityId(v._id);
        if (v.id) return getEntityId(v.id);
        if (v.userId) return getEntityId(v.userId);
    }
    return String(value);
};

// ─── Live Session Timer ───────────────────────────────────────────────────────
function LiveTimer({ startedAt, baseSeconds = 0 }: { startedAt: string; baseSeconds?: number }) {
    const [currentSessionSecs, setCurrentSessionSecs] = useState(0);

    useEffect(() => {
        const start = new Date(startedAt).getTime();
        const update = () =>
            setCurrentSessionSecs(Math.max(0, Math.floor((Date.now() - start) / 1000)));
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [startedAt]);

    const totalSecs = baseSeconds + currentSessionSecs;
    const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');

    return (
        <span className="text-[10px] font-mono tabular-nums leading-none" style={{ color: 'var(--color-success, #10B981)' }}>
            {h}:{m}:{s}
        </span>
    );
}

// ─── Status Dropdown ──────────────────────────────────────────────────────────
export interface StatusDropdownProps {
    task: Task;
    projectId: string;
    currentUserId: string;
    canManage?: boolean;
    hasSubtasks?: boolean;
    size?: 'sm' | 'xs';
}

export function StatusDropdown({
    task,
    projectId,
    currentUserId,
    canManage = false,
    hasSubtasks = false,
    size = 'sm',
}: StatusDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const [updateTask, { isLoading }] = useUpdateTaskMutation();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isLocked = task.status === 'completed';
    const isAutoManaged = hasSubtasks;

    const isAssignee = task.assignees.some((a) => getEntityId(a) === currentUserId);
    const canInteract = (isAssignee || canManage) && !isAutoManaged;

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const activeTimer = task.activeTimers?.find((t) => getEntityId(t.userId) === currentUserId);
    const accEntry = task.accumulatedSeconds?.find((a) => getEntityId(a.userId) === currentUserId);
    const baseSeconds = accEntry?.seconds ?? 0;

    const allowedNext: Record<string, Task['status'][]> = {
        'todo': ['in-progress'],
        'in-progress': ['paused', 'completed'],
        'paused': ['in-progress', 'completed'],
        'completed': [],
    };
    const validNext = allowedNext[task.status] ?? [];

    const allOptions: { value: Task['status']; label: string }[] = [
        { value: 'todo', label: 'To Do' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'paused', label: 'Paused' },
        { value: 'completed', label: 'Completed' },
    ];
    const options = allOptions.filter(o => o.value === task.status || validNext.includes(o.value));

    const handleOpen = () => {
        if (isLoading || isLocked || isAutoManaged || !canInteract) return;
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const estimatedHeight = 160;
            const top = spaceBelow < estimatedHeight && rect.top > estimatedHeight
                ? rect.top - estimatedHeight - 4
                : rect.bottom + 4;
            setDropdownPos({ top, left: rect.left });
        }
        setIsOpen(v => !v);
    };

    const handleSelect = async (newStatus: Task['status']) => {
        setIsOpen(false);
        if (newStatus === task.status || isLocked || isAutoManaged || !canInteract) return;
        if (!validNext.includes(newStatus)) return;
        try {
            await updateTask({ projectId, taskId: task._id, data: { status: newStatus } }).unwrap();
        } catch (err: unknown) {
            const error = err as { data?: { message?: string }; message?: string };
            const message = error?.data?.message || error?.message || 'Failed to update status';
            alert(message);
        }
    };

    if (!canInteract || isAutoManaged) {
        const lockTitle = isAutoManaged ? 'Status auto-managed from subtasks' : 'Only assigned team members can change this task\'s status';
        return (
            <div className="inline-flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()} title={isLocked ? 'Task completed — status is locked' : lockTitle}>
                <div className={`flex items-center gap-1 opacity-80 ${size === 'xs' ? 'scale-90 origin-left' : ''}`}>
                    <StatusBadge status={task.status} dot />
                    {isAutoManaged ? <span className="text-[9px] ml-0.5 opacity-60">auto</span> : (isLocked && <Lock size={8} style={{ color: 'var(--color-text-muted)' }} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="relative inline-flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
                ref={triggerRef}
                onClick={handleOpen}
                disabled={isLoading}
                className={`flex items-center gap-1 transition-colors ${isLocked ? 'cursor-not-allowed opacity-80' : 'hover:brightness-95 cursor-pointer'} disabled:opacity-60 ${size === 'xs' ? 'scale-90 origin-left' : ''}`}
                title={isLocked ? 'Task completed — status is locked' : 'Click to change status'}
            >
                <StatusBadge status={task.status} dot />
                {isLocked ? <Lock size={8} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={12} style={{ color: 'var(--color-text-muted)' }} />}
            </button>

            {activeTimer && (
                <div className="flex items-center gap-1 pl-1">
                    <Clock size={9} style={{ color: 'var(--color-success, #10B981)' }} className="animate-pulse flex-shrink-0" />
                    <LiveTimer startedAt={activeTimer.startedAt} baseSeconds={baseSeconds} />
                </div>
            )}

            {isOpen && !isLocked && createPortal(
                <div
                    ref={dropdownRef}
                    className="z-[9999] min-w-[150px] rounded-lg border shadow-xl overflow-hidden"
                    style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                >
                    {options.map((opt) => {
                        const isCurrent = opt.value === task.status;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => handleSelect(opt.value)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-black/5"
                                style={{ backgroundColor: isCurrent ? 'var(--color-primary-soft)' : 'transparent', color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-primary)' }}
                            >
                                <StatusBadge status={opt.value} dot />
                                {isCurrent && <span className="ml-auto text-[10px]" style={{ color: 'var(--color-primary)' }}>✓</span>}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
}
