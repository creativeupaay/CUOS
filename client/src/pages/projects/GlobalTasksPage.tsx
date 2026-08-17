import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    Plus, Search, Pause,
    Calendar, RefreshCcw,
    CheckCircle2, Circle, Loader2, X,
    Trash2, Clock, MoreHorizontal, Filter, Pencil, LayoutGrid, List,
} from 'lucide-react';
import { useGlobalTasks, type GlobalTask, type GlobalTaskFilters } from '@/hooks/useGlobalTasks';

import { formatElapsed } from '@/hooks/useTaskTimer';
import GlobalTaskFormPanel, { type NewTaskFormData } from '@/components/organisms/project/GlobalTaskFormPanel';
import GlobalMeetingsView from '@/components/organisms/project/GlobalMeetingsView';
import { DailyTodosBoard, DailyTodosList } from '@/components/organisms/project';
import DailyOverviewPage from './DailyOverviewPage';
import toast from 'react-hot-toast';

// ─── Bulk Task Modal Component ───────────────────────────────────────────────

function BulkTaskModal({ onClose, onSubmit, isSubmitting }: { onClose: () => void; onSubmit: (tasks: string[]) => void; isSubmitting: boolean }) {
    const [text, setText] = useState('');
    

    
    const handleSubmit = () => {
        const lines = text.split('\n').map(t => t.trim()).filter(Boolean);
        if (lines.length === 0) return;
        onSubmit(lines);
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ zIndex: 999999 }}>
            <div className="w-full max-w-2xl rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Add Bulk Tasks</h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Enter each task on a new line.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full transition-colors" style={{ color: 'var(--color-text-muted)' }}><X size={18} /></button>
                </div>
                <div className="p-6">
                    <textarea 
                        autoFocus
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Task 1&#10;Task 2&#10;Task 3..."
                        className="w-full h-64 p-4 border rounded-xl text-sm outline-none resize-none"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                    />
                </div>
                <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}>Cancel</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !text.trim()} 
                        className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white rounded-lg opacity-90 hover:opacity-100 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Add {text.split('\n').filter(t => t.trim()).length || ''} Tasks
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
    low:      { color: '#10B981', dot: 'bg-emerald-400', label: 'Low'      },
    medium:   { color: '#F59E0B', dot: 'bg-amber-400',   label: 'Medium'   },
    high:     { color: '#EA580C', dot: 'bg-orange-500',  label: 'High'     },
    critical: { color: '#EF4444', dot: 'bg-red-500',     label: 'Critical' },
};

const STATUS_OPTIONS: Array<{ value: GlobalTask['status']; label: string; color: string; icon: React.ReactNode }> = [
    { value: 'todo',        label: 'To Do',       color: '#9CA3AF', icon: <Circle       size={14} /> },
    { value: 'in-progress', label: 'In Progress', color: '#3B82F6', icon: <RefreshCcw   size={14} /> },
    { value: 'paused',      label: 'Paused',      color: '#F59E0B', icon: <Pause        size={14} /> },
    { value: 'completed',   label: 'Completed',   color: '#10B981', icon: <CheckCircle2 size={14} /> },
];

function getStatusCfg(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0];
}


// ─── Status dropdown cell ─────────────────────────────────────────────────────


function StatusCell({ task }: { task: GlobalTask }) {
    const sc = getStatusCfg(task.status);
    return (
        <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium w-max"
            style={{ color: sc.color, backgroundColor: sc.color + '15' }}
        >
            {sc.icon}
            {sc.label}
        </div>
    );
}

// ─── Priority cell ────────────────────────────────────────────────────────────

function PriorityCell({ priority }: { priority: string }) {
    const pc = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG['medium'];
    return (
        <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pc.color }} />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{pc.label}</span>
        </div>
    );
}

// ─── Row actions ──────────────────────────────────────────────────────────────

function RowActions({ task, onEdit, onDelete }: { task: GlobalTask; onEdit: (t: GlobalTask) => void; onDelete: (t: GlobalTask) => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, right: 0 });

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (btnRef.current?.contains(e.target as Node)) return;
            if (menuRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        const scrollHandler = () => setOpen(false);
        document.addEventListener('mousedown', handler);
        window.addEventListener('scroll', scrollHandler, true);
        return () => {
            document.removeEventListener('mousedown', handler);
            window.removeEventListener('scroll', scrollHandler, true);
        };
    }, [open]);

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        }
        setOpen(!open);
    };

    return (
        <>
            <button
                ref={btnRef}
                onClick={handleOpen}
                className="p-1.5 rounded-lg transition-all hover:bg-black/5"
                style={{ color: 'var(--color-text-muted)' }}
            >
                <MoreHorizontal size={14} />
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    className="fixed w-32 rounded-xl border shadow-xl py-1 z-[9999]"
                    style={{ 
                        top: coords.top, 
                        right: coords.right,
                        backgroundColor: 'var(--color-bg-surface)', 
                        borderColor: 'var(--color-border-default)' 
                    }}
                >
                    <button
                        onClick={() => { onEdit(task); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-black/5"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        <Pencil size={12} /> Edit
                    </button>
                    <button
                        onClick={() => { onDelete(task); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={12} /> Delete
                    </button>
                </div>,
                document.body
            )}
        </>
    );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
    task,
    isAdmin,
    onEdit,
    onDelete,
}: {
    task: GlobalTask;
    isAdmin: boolean;
    onEdit: (t: GlobalTask) => void;
    onDelete: (t: GlobalTask) => void;
}) {
    const totalSecs = (task.accumulatedSeconds || []).reduce((a, b) => a + b.seconds, 0);
    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
    const sc = getStatusCfg(task.status);

    return (
        <tr
            className="group border-b transition-colors hover:bg-black/[0.02]"
            style={{ borderColor: 'var(--color-border-default)' }}
        >
            {/* Status + Title */}
            <td className="py-2.5 pl-4 pr-2" style={{ minWidth: 280 }}>
                <div className="flex items-center gap-2.5">
                    {/* Status icon display */}
                    <div
                        className="flex-shrink-0"
                        title={`Status: ${sc.label}`}
                        style={{ color: sc.color }}
                    >
                        {sc.icon}
                    </div>
                    <span
                        className={`text-sm font-medium truncate max-w-xs ${task.status === 'completed' ? 'line-through opacity-50' : ''}`}
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        {task.title}
                    </span>
                </div>
            </td>

            {/* Status badge */}
            <td className="py-2.5 px-3" style={{ minWidth: 140 }}>
                <StatusCell task={task} />
            </td>

            {/* Due date */}
            <td className="py-2.5 px-3" style={{ minWidth: 110 }}>
                {task.deadline ? (
                    <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: isOverdue ? '#EF4444' : 'var(--color-text-secondary)' }}
                    >
                        <Calendar size={11} />
                        {new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        {isOverdue && <span className="text-[10px] font-semibold text-red-500 ml-1">Overdue</span>}
                    </span>
                ) : (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                )}
            </td>

            {/* Priority */}
            <td className="py-2.5 px-3" style={{ minWidth: 100 }}>
                <PriorityCell priority={task.priority} />
            </td>

            {/* Project */}
            <td className="py-2.5 px-3" style={{ minWidth: 150 }}>
                <span className="text-xs truncate block max-w-[140px]" style={{ color: 'var(--color-text-secondary)' }}>
                    {task._projectId ? task._projectName : '—'}
                </span>
            </td>

            {/* Time logged */}
            <td className="py-2.5 px-3" style={{ minWidth: 90 }}>
                {totalSecs > 0 ? (
                    <span className="flex items-center gap-1 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                        <Clock size={11} />
                        {formatElapsed(totalSecs)}
                    </span>
                ) : (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                )}
            </td>

            {/* Created By (Admin only) */}
            {isAdmin && (
                <td className="py-2.5 px-3" style={{ minWidth: 120 }}>
                    <span className="text-xs truncate block max-w-[120px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {task.createdBy && typeof task.createdBy === 'object' ? (task.createdBy as any).name || (task.createdBy as any).email : '—'}
                    </span>
                </td>
            )}

            {/* Actions */}
            <td className="py-2.5 pr-4 pl-2 text-right">
                <RowActions task={task} onEdit={onEdit} onDelete={onDelete} />
            </td>
        </tr>
    );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ tasks, activeFilter, onFilter }: { tasks: GlobalTask[]; activeFilter: string; onFilter: (s: string) => void }) {
    const stats = [
        { key: 'todo',        label: 'To Do',       color: '#9CA3AF', count: tasks.filter(t => t.status === 'todo').length },
        { key: 'in-progress', label: 'In Progress',  color: '#3B82F6', count: tasks.filter(t => t.status === 'in-progress').length },
        { key: 'paused',      label: 'Paused',       color: '#F59E0B', count: tasks.filter(t => t.status === 'paused').length },
        { key: 'completed',   label: 'Completed',    color: '#10B981', count: tasks.filter(t => t.status === 'completed').length },
    ];
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {stats.map(s => (
                <button
                    key={s.key}
                    onClick={() => onFilter(activeFilter === s.key ? 'all' : s.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                    style={{
                        backgroundColor: activeFilter === s.key ? s.color + '18' : 'var(--color-bg-surface)',
                        borderColor: activeFilter === s.key ? s.color + '60' : 'var(--color-border-default)',
                        color: activeFilter === s.key ? s.color : 'var(--color-text-secondary)',
                    }}
                >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                    <span className="font-bold ml-0.5">{s.count}</span>
                </button>
            ))}
        </div>
    );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function GlobalTasksInner() {
    const {
        filteredTasks, allTasks, projects,
        filters, setFilters,
        isAdmin, isLoading,
        createTask, updateTask, deleteTask, logTime,
        isCreating,
    } = useGlobalTasks();

    const currentUserId = useSelector((state: RootState) => state.auth.user?._id);

    const [activeMainTab, setActiveMainTab] = useState<'my' | 'all' | 'my-meetings' | 'all-meetings' | 'board' | 'daily-overview'>('board');
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const activeTabParam = searchParams.get('activeTab');
        const isOverdueParam = searchParams.get('isOverdue');
        const userIdParam = searchParams.get('userId');

        if (activeTabParam) {
            setActiveMainTab(activeTabParam as any);
            if (activeTabParam === 'all' && userIdParam) {
                setFilters({ owner: 'all', userId: userIdParam, isOverdue: isOverdueParam === 'true' });
            } else if (activeTabParam === 'my') {
                setFilters({ owner: 'my', isOverdue: isOverdueParam === 'true' });
            } else if (activeTabParam === 'all') {
                setFilters({ owner: 'all', isOverdue: isOverdueParam === 'true' });
            }
        }
    }, [searchParams, setFilters]);



    const [showForm, setShowForm] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [showTaskMenu, setShowTaskMenu] = useState(false);
    const taskMenuRef = useRef<HTMLDivElement>(null);

    // Close task menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (taskMenuRef.current && !taskMenuRef.current.contains(e.target as Node)) {
                setShowTaskMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const [taskToEdit, setTaskToEdit] = useState<GlobalTask | undefined>();
    
    const [showFilters, setShowFilters] = useState(false);
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<GlobalTask | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [dailyTodosView, setDailyTodosView] = useState<'board' | 'list'>('board');
    const [filterTab, setFilterTab] = useState<'priority' | 'project' | 'date' | 'user'>('priority');
    const filterRef = useRef<HTMLDivElement>(null);

    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setPage(1);
    }, [filters]);

    useEffect(() => {
        if (!showFilters) return;
        const handler = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showFilters]);

    const mainTabs = [
        { value: 'board' as const, label: "Daily Todo's" },
        ...(isAdmin ? [{ value: 'daily-overview' as const, label: 'Daily Overview' }] : []),
        { value: 'my' as const, label: 'My Tasks' },
        ...(isAdmin ? [{ value: 'all' as const, label: 'All Tasks' }] : []),
        { value: 'my-meetings' as const, label: 'My Meetings' },
        ...(isAdmin ? [{ value: 'all-meetings' as const, label: 'All Meetings' }] : [])
    ];

    const usersFilterList = useMemo(() => {
        const userMap = new Map<string, { _id: string; name: string }>();
        allTasks.forEach(t => {
            t.assignees?.forEach(a => {
                if (a && typeof a === 'object' && (a as any)._id && ((a as any).name || (a as any).email)) {
                    userMap.set((a as any)._id, { _id: (a as any)._id, name: (a as any).name || (a as any).email });
                }
            });
            if (t.createdBy && typeof t.createdBy === 'object' && (t.createdBy as any)._id && ((t.createdBy as any).name || (t.createdBy as any).email)) {
                userMap.set((t.createdBy as any)._id, { _id: (t.createdBy as any)._id, name: (t.createdBy as any).name || (t.createdBy as any).email });
            }
        });
        return Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [allTasks]);

    const handleCreateTask = useCallback(async (data: NewTaskFormData) => {
        if (data.taskType === 'project' && !data.projectId) {
            toast.error('Please select a project.');
            return;
        }
        setIsSaving(true);
        try {
        const result = await createTask(data.taskType === 'individual' ? '' : data.projectId, {
            title: data.title,
            description: data.description || undefined,
            status: data.status,
            priority: data.priority,
            deadline: data.deadline || undefined,
            estimatedHours: (data.timeSpentHours + data.timeSpentMins / 60) || undefined,
            ...(data.isRecurring && data.recurrenceEndDate ? {
                recurrence: {
                    frequency: data.recurrenceFreq,
                    endDate: data.recurrenceEndDate,
                    daysOfWeek: data.recurrenceFreq === 'weekly' ? data.recurrenceDays : undefined,
                }
            } : {})
        });
        if (result) {
            if (data.timeSpentHours > 0 || data.timeSpentMins > 0) {
                if (data.taskType !== 'individual') {
                    await logTime(data.projectId, result._id, data.timeSpentHours * 60 + data.timeSpentMins, 'Initial time');
                }
            }
            toast.success(data.taskType === 'individual' ? 'Individual task created!' : 'Task created!');
            setShowForm(false);
        }
        } finally {
            setIsSaving(false);
        }
    }, [createTask, logTime]);

    const handleEditTaskSubmit = useCallback(async (data: NewTaskFormData) => {
        if (!taskToEdit) return;
        setIsSaving(true);
        try {
            await updateTask(taskToEdit._projectId, taskToEdit._id, {
                title: data.title,
                description: data.description || undefined,
                status: data.status,
                priority: data.priority,
                deadline: data.deadline || undefined,
                estimatedHours: (data.timeSpentHours + data.timeSpentMins / 60) || undefined,
                projectId: data.taskType === 'project' ? data.projectId : undefined,
            });
            toast.success('Task updated!');
            setTaskToEdit(undefined);
        } finally {
            setIsSaving(false);
        }
    }, [taskToEdit, updateTask]);

    const handleDelete = useCallback((task: GlobalTask) => {
        setTaskToDelete(task);
    }, []);

    const executeDeleteTask = useCallback(async () => {
        if (!taskToDelete) return;
        setIsDeleting(true);
        try {
            await deleteTask(taskToDelete._projectId, taskToDelete._id);
            toast.success('Task deleted');
            setTaskToDelete(null);
        } finally {
            setIsDeleting(false);
        }
    }, [taskToDelete, deleteTask]);

    const handleBulkTaskSubmit = useCallback(async (taskTitles: string[]) => {
        setIsSaving(true);
        try {
            await Promise.all(taskTitles.map(title => 
                createTask('', {
                    title,
                    status: 'todo',
                    priority: 'medium'
                })
            ));
            toast.success(`Successfully added ${taskTitles.length} tasks!`);
            setIsBulkModalOpen(false);
        } catch (error) {
            console.error('Failed to add bulk tasks:', error);
            toast.error('Failed to add some tasks. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [createTask]);




    const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
    const statusOrder = { 'todo': 1, 'in-progress': 2, 'paused': 3, 'completed': 4 };

    const sortedTasks = React.useMemo(() => {
        return [...filteredTasks].sort((a, b) => {
            const s1 = statusOrder[a.status as keyof typeof statusOrder] || 99;
            const s2 = statusOrder[b.status as keyof typeof statusOrder] || 99;
            if (s1 !== s2) return s1 - s2;
            
            const p1 = priorityOrder[a.priority as keyof typeof priorityOrder] || 99;
            const p2 = priorityOrder[b.priority as keyof typeof priorityOrder] || 99;
            if (p1 !== p2) return p1 - p2;

            return 0;
        });
    }, [filteredTasks]);

    const totalPages = Math.ceil(sortedTasks.length / ITEMS_PER_PAGE);
    const paginatedTasks = sortedTasks.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className="px-6 py-6 page-enter" style={{ maxWidth: '1300px' }}>
            {isBulkModalOpen && (
                <BulkTaskModal 
                    onClose={() => setIsBulkModalOpen(false)} 
                    onSubmit={handleBulkTaskSubmit} 
                    isSubmitting={isSaving} 
                />
            )}

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
                <div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (activeMainTab !== 'my-meetings' && activeMainTab !== 'all-meetings') {
                                setActiveMainTab('my-meetings');
                                setTimeout(() => window.dispatchEvent(new CustomEvent('cuos:openMeetingForm')), 50);
                            } else {
                                window.dispatchEvent(new CustomEvent('cuos:openMeetingForm'));
                            }
                        }}
                        className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-full transition-all hover:bg-black/5 active:scale-95 border"
                        style={{ 
                            color: 'var(--color-text-primary)',
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)' 
                        }}
                    >
                        Add Meeting
                    </button>
                    <div className="relative" ref={taskMenuRef}>
                        <div className="flex rounded-full shadow-sm overflow-hidden border transition-all active:scale-95" style={{ borderColor: 'var(--color-primary)' }}>
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 border-r border-white/20"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                                <Plus size={15} /> New Task
                            </button>
                            <button
                                onClick={() => setShowTaskMenu(p => !p)}
                                className="px-3 py-2.5 text-white hover:opacity-90 flex items-center justify-center"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </button>
                        </div>
                        {showTaskMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border rounded-3xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        toast.success("Opening Bulk Tasks...");
                                        setIsBulkModalOpen(true);
                                        setShowTaskMenu(false);
                                    }}
                                    className="w-full text-left px-5 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-700"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                                    Add Bulk Tasks
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Owner tabs ── */}
            <div className="flex gap-0 border-b mb-4 overflow-x-auto hide-scrollbar whitespace-nowrap" style={{ borderColor: 'var(--color-border-default)' }}>
                {mainTabs.map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => {
                            setActiveMainTab(tab.value);
                            if (tab.value === 'my' || tab.value === 'all') {
                                setFilters({ owner: tab.value });
                            }
                        }}
                        className="px-4 py-2 text-sm font-medium border-b-2 transition-all"
                        style={{
                            color: activeMainTab === tab.value ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            borderColor: activeMainTab === tab.value ? 'var(--color-primary)' : 'transparent',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeMainTab === 'my-meetings' || activeMainTab === 'all-meetings' ? (
                <GlobalMeetingsView owner={activeMainTab === 'all-meetings' ? 'all' : 'my'} />
            ) : activeMainTab === 'daily-overview' ? (
                <div className="-mx-6 -mb-6 min-h-[750px]">
                    <DailyOverviewPage />
                </div>
            ) : activeMainTab === 'board' ? (
                <>
                    <div className="flex justify-end mb-4">
                        <div className="bg-black/5 p-1 rounded-xl flex items-center gap-1 border border-black/5">
                            <button
                                onClick={() => setDailyTodosView('board')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${dailyTodosView === 'board' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                <LayoutGrid size={16} /> Board
                            </button>
                            <button
                                onClick={() => setDailyTodosView('list')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${dailyTodosView === 'list' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                <List size={16} /> List
                            </button>
                        </div>
                    </div>
                    {dailyTodosView === 'board' ? <DailyTodosBoard /> : <DailyTodosList />}
                </>
            ) : (
                <>
                    {/* ── Stats + Filters row ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2">
                    <StatsBar
                        tasks={allTasks.filter(task => {
                            // Apply all filters EXCEPT status
                            if (filters.owner === 'my') {
                                const isAssigned = task.assignees.some(a => (a as any)._id === currentUserId || a === currentUserId);
                                const isCreator = (task.createdBy as any)?._id === currentUserId || task.createdBy === currentUserId;
                                if (!isAssigned && !isCreator) return false;
                            }
                            if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
                            if (filters.projectId === '__personal__') {
                                if (task._projectId !== '') return false;
                            } else if (filters.projectId && task._projectId !== filters.projectId) return false;
                            if (filters.dateFrom) {
                                const from = new Date(filters.dateFrom);
                                const dl = task.deadline ? new Date(task.deadline) : null;
                                if (!dl || dl < from) return false;
                            }
                            if (filters.dateTo) {
                                const to = new Date(filters.dateTo);
                                to.setHours(23, 59, 59, 999);
                                const dl = task.deadline ? new Date(task.deadline) : null;
                                if (!dl || dl > to) return false;
                            }
                            if (filters.userId) {
                                const isAssigned = task.assignees.some(a => (a as any)._id === filters.userId || a === filters.userId);
                                const isCreator = (task.createdBy as any)?._id === filters.userId || task.createdBy === filters.userId;
                                if (!isAssigned && !isCreator) return false;
                            }
                            if (filters.search) {
                                const q = filters.search.toLowerCase();
                                const inTitle = task.title.toLowerCase().includes(q);
                                if (!inTitle && !task._projectName.toLowerCase().includes(q)) return false;
                            }
                            if (filters.isOverdue) {
                                if (!task.deadline) return false;
                                const dl = new Date(task.deadline);
                                const now = new Date();
                                if (dl.getTime() >= now.getTime()) return false;
                                if (task.status === 'completed') return false;
                            }
                            return true;
                        })}
                        activeFilter={filters.status}
                        onFilter={s => setFilters({ status: s as GlobalTaskFilters['status'] })}
                    />
                    {(filters.status !== 'all' || filters.priority !== 'all' || filters.projectId || filters.dateFrom || filters.dateTo || filters.search || filters.isOverdue) && (
                        <button
                            onClick={() => setFilters({ status: 'all', priority: 'all', projectId: '', dateFrom: '', dateTo: '', search: '', isOverdue: false })}
                            className="p-1 rounded-full border shadow-sm transition-transform hover:scale-110 flex-shrink-0"
                            style={{ backgroundColor: '#ffffff', borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}
                            title="Clear all filters"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div 
                        className="relative flex items-center transition-all duration-300 ease-in-out overflow-hidden rounded-lg border"
                        style={{ 
                            width: searchExpanded || filters.search ? '208px' : '32px',
                            height: '30px',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)'
                        }}
                    >
                        <div className="absolute left-0 top-0 w-[30px] h-full flex items-center justify-center pointer-events-none">
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                        <input
                            type="text"
                            value={filters.search}
                            onChange={e => setFilters({ search: e.target.value })}
                            onFocus={() => setSearchExpanded(true)}
                            onBlur={() => {
                                if (!filters.search) setSearchExpanded(false);
                            }}
                            placeholder="Search tasks…"
                            className={`absolute left-0 top-0 pl-8 pr-3 h-full text-xs bg-transparent outline-none transition-opacity duration-300 ${(!searchExpanded && !filters.search) ? 'opacity-0 cursor-pointer' : 'opacity-100 cursor-text'}`}
                            style={{ color: 'var(--color-text-primary)', width: '208px' }}
                        />
                    </div>

                    {/* Filter Dropdown */}
                    <div ref={filterRef} className="relative">
                        <button
                            onClick={() => setShowFilters(p => !p)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-black/5"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                        >
                            <Filter size={12} />
                            Filters
                            {(filters.priority !== 'all' || filters.projectId || filters.dateFrom || filters.dateTo || filters.userId) && (
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                            )}
                        </button>

                        {showFilters && (
                            <div
                                className="absolute right-0 top-full mt-2 w-[240px] rounded-xl shadow-xl border z-50 flex overflow-hidden"
                                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                            >
                                {/* Left side tabs */}
                                <div className="w-1/3 border-r bg-black/5" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <button
                                        onClick={() => setFilterTab('priority')}
                                        className="w-full text-left px-4 py-3 text-xs font-semibold transition-colors"
                                        style={{ backgroundColor: filterTab === 'priority' ? 'var(--color-bg-surface)' : 'transparent', color: filterTab === 'priority' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        Priority
                                    </button>
                                    <button
                                        onClick={() => setFilterTab('project')}
                                        className="w-full text-left px-4 py-3 text-xs font-semibold transition-colors"
                                        style={{ backgroundColor: filterTab === 'project' ? 'var(--color-bg-surface)' : 'transparent', color: filterTab === 'project' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        Project
                                    </button>
                                    <button
                                        onClick={() => setFilterTab('date')}
                                        className="w-full text-left px-4 py-3 text-xs font-semibold transition-colors"
                                        style={{ backgroundColor: filterTab === 'date' ? 'var(--color-bg-surface)' : 'transparent', color: filterTab === 'date' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        Date
                                    </button>
                                    {isAdmin && activeMainTab === 'all' && (
                                        <button
                                            onClick={() => setFilterTab('user')}
                                            className="w-full text-left px-4 py-3 text-xs font-semibold transition-colors"
                                            style={{ backgroundColor: filterTab === 'user' ? 'var(--color-bg-surface)' : 'transparent', color: filterTab === 'user' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                        >
                                            User
                                        </button>
                                    )}
                                </div>

                                {/* Right side content */}
                                <div className="w-2/3 p-4">
                                    {filterTab === 'priority' && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Select Priority</label>
                                            <div className="flex flex-col gap-2">
                                                {['low', 'medium', 'high', 'critical'].map(p => (
                                                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" checked={filters.priority === p} onChange={() => setFilters({ priority: p as GlobalTaskFilters['priority'] })} />
                                                        <span className="text-xs capitalize">{p}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {filterTab === 'project' && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Select Project</label>
                                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" checked={filters.projectId === '__personal__'} onChange={() => setFilters({ projectId: '__personal__' })} />
                                                    <span className="text-xs truncate">Personal Tasks</span>
                                                </label>
                                                {projects.map(p => (
                                                    <label key={p._id} className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" checked={filters.projectId === p._id} onChange={() => setFilters({ projectId: p._id })} />
                                                        <span className="text-xs truncate" title={p.name}>{p.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {filterTab === 'date' && (
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Start Date</label>
                                                <input type="date" value={filters.dateFrom} onChange={e => setFilters({ dateFrom: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none cursor-text"
                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>End Date</label>
                                                <input type="date" value={filters.dateTo} onChange={e => setFilters({ dateTo: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none cursor-text"
                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {filterTab === 'user' && isAdmin && activeMainTab === 'all' && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Select User</label>
                                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" checked={filters.userId === ''} onChange={() => setFilters({ userId: '' })} />
                                                    <span className="text-xs truncate">All Users</span>
                                                </label>
                                                {usersFilterList.map((u: { _id: string; name: string }) => (
                                                    <label key={u._id} className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" checked={filters.userId === u._id} onChange={() => setFilters({ userId: u._id })} />
                                                        <span className="text-xs truncate" title={u.name}>{u.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Task List ── */}
            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    <span className="ml-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading tasks…</span>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div
                    className="flex flex-col items-center justify-center py-24 rounded-2xl border"
                    style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', borderStyle: 'dashed' }}
                >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg,rgba(102,126,234,.12),rgba(118,75,162,.12))' }}>
                        <CheckCircle2 size={26} style={{ color: '#667eea' }} />
                    </div>
                    <p className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>No tasks found</p>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Create your first task to get started</p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        <Plus size={14} /> New Task
                    </button>
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left whitespace-nowrap min-w-[800px]">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
                                <th className="py-2.5 pl-4 pr-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Task name</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Status</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Due date</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Priority</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Project</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Time logged</th>
                                {isAdmin && <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Created By</th>}
                                <th className="py-2.5 pr-4 pl-2 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTasks.map(task => (
                                <TaskRow
                                    key={task._id}
                                    task={task}
                                    isAdmin={isAdmin}
                                    onEdit={t => setTaskToEdit(t)}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </tbody>
                    </table>
                    </div>
                    {/* Add task row */}
                    <div
                        className="border-t px-4 py-2.5"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 text-sm transition-all hover:opacity-80"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            <Plus size={14} /> Add task…
                        </button>
                    </div>

                    {/* Pagination */}
                    {sortedTasks.length > ITEMS_PER_PAGE && (
                        <div className="border-t px-4 py-3 flex items-center justify-between" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, sortedTasks.length)} of {sortedTasks.length} tasks
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-2.5 py-1 text-xs rounded border disabled:opacity-50 transition-colors hover:bg-black/5"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                >
                                    Prev
                                </button>
                                <div className="text-xs font-semibold px-2" style={{ color: 'var(--color-text-primary)' }}>
                                    {page} / {totalPages}
                                </div>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-2.5 py-1 text-xs rounded border disabled:opacity-50 transition-colors hover:bg-black/5"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
                </>
            )}

            {/* Form panel */}
            {(showForm || taskToEdit) && (
                <GlobalTaskFormPanel
                    projects={projects}
                    isCreating={isSaving || isCreating}
                    initialData={taskToEdit}
                    onClose={() => { setShowForm(false); setTaskToEdit(undefined); }}
                    onSubmit={taskToEdit ? handleEditTaskSubmit : handleCreateTask}
                />
            )}



            {/* Delete Confirmation Modal */}
            {taskToDelete && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="rounded-2xl shadow-2xl w-full max-w-sm p-6 relative" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                        <button onClick={() => setTaskToDelete(null)} className="absolute top-4 right-4 transition-colors hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
                            <X size={18} />
                        </button>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                <Trash2 size={24} style={{ color: 'var(--color-danger)' }} />
                            </div>
                            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Delete Task</h3>
                            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                                Are you sure you want to delete <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>"{taskToDelete.title}"</span>? This action cannot be undone.
                            </p>
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    onClick={() => setTaskToDelete(null)}
                                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                                    style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeDeleteTask}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50 flex items-center justify-center"
                                    style={{ backgroundColor: 'var(--color-danger)', color: '#fff' }}
                                >
                                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function GlobalTasksPage() {
    // TimerProvider is now global (in DashboardLayout) — no need to wrap here
    return <GlobalTasksInner />;
}
