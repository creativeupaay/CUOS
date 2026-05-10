import React from 'react';
import { Plus, MoreVertical, FileText, Pencil } from 'lucide-react';
import type { Task } from '@/features/project';
import { Avatar } from '@/components/atoms/Avatar';
import { PRIORITY_STYLES, STATUS_STYLES, STATUS_LABELS } from '@/data/project/taskConstants';

// ── Board Card ────────────────────────────────────────────────────────────────

interface BoardCardProps {
    task: Task;
    onEdit: (t: Task) => void;
}

function MainCard({ task, onEdit }: BoardCardProps) {
    return (
        <div
            draggable
            onDragStart={(e) => e.dataTransfer.setData('taskId', task._id)}
            className="p-3 rounded-lg border shadow-sm group hover:shadow-md transition-all cursor-pointer bg-white"
            style={{ borderColor: 'var(--color-border-default)' }}
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="text-xs font-semibold leading-relaxed pr-4 flex items-start gap-2" style={{ color: 'var(--color-text-primary)' }}>
                    <FileText size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: '1px' }} />
                    <span>{task.title}</span>
                </h4>
                <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity" style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <MoreVertical size={14} />
                </button>
            </div>
            {task.description && (
                <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--color-text-secondary)' }}>{task.description}</p>
            )}
            <div className="flex flex-col gap-2 pt-2 mt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                <div className="flex flex-wrap gap-1.5">
                    {task.assignees.length > 0 ? task.assignees.map((assignee, i) => {
                        const name = typeof assignee === 'object' && (assignee as unknown as Record<string, unknown>).name
                            ? (assignee as unknown as Record<string, unknown>).name as string
                            : typeof assignee === 'object' && 'userId' in (assignee as unknown as Record<string, unknown>) && typeof (assignee as unknown as Record<string, unknown>).userId === 'object'
                                ? ((assignee as unknown as Record<string, unknown>).userId as Record<string, unknown>).name as string
                                : 'User';
                        const photoUrl = (assignee as unknown as Record<string, unknown>).profilePhoto as string || null;
                        return (
                            <div key={i} className="flex items-center gap-1 pr-1.5 bg-black/5 rounded-full shrink-0">
                                <Avatar name={name} photoUrl={photoUrl} size={20} />
                                <span className="text-[10px] font-medium truncate max-w-[60px]" style={{ color: 'var(--color-text-secondary)' }}>{name}</span>
                            </div>
                        );
                    }) : <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>}
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium pb-1" style={{ color: 'var(--color-text-muted)' }}>
                    {task.deadline ? <span>{new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> : <span />}
                    <span className="px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: PRIORITY_STYLES[task.priority]?.bg || '#f3f4f6', color: PRIORITY_STYLES[task.priority]?.text || '#4b5563' }}>{task.priority}</span>
                </div>
            </div>
        </div>
    );
}

function SubCard({ task }: { task: Task }) {
    return (
        <div
            draggable
            onDragStart={(e) => e.dataTransfer.setData('taskId', task._id)}
            className="px-2.5 py-2 rounded-md border group hover:shadow-sm transition-all cursor-pointer"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', borderLeft: `3px solid ${STATUS_STYLES[task.status]?.dot || '#9CA3AF'}` }}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Pencil size={10} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <span className="text-[11px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{task.title}</span>
                </div>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded capitalize flex-shrink-0" style={{ backgroundColor: PRIORITY_STYLES[task.priority]?.bg || '#f3f4f6', color: PRIORITY_STYLES[task.priority]?.text || '#4b5563' }}>
                    {task.priority}
                </span>
            </div>
            {task.assignees.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5">
                    {task.assignees.slice(0, 3).map((a, i) => {
                        const name = (a as unknown as Record<string, unknown>)?.name as string || 'U';
                        const photoUrl = (a as unknown as Record<string, unknown>)?.profilePhoto as string || null;
                        return <Avatar key={i} name={name} photoUrl={photoUrl} size={16} />;
                    })}
                </div>
            )}
        </div>
    );
}

// ── Board Column ──────────────────────────────────────────────────────────────

interface BoardColumnProps {
    title: string;
    statusId: string;
    tasks: Task[];
    onEdit: (t: Task) => void;
    onNew: () => void;
    onDrop: (taskId: string, newStatus: string) => void;
}

function BoardColumn({ title, statusId, tasks, onEdit, onNew, onDrop }: BoardColumnProps) {
    const dotColor = STATUS_STYLES[statusId]?.dot || '#9CA3AF';
    const mainCards = tasks.filter(t => !t.parentTaskId);
    const subtaskCards = tasks.filter(t => t.parentTaskId);

    return (
        <div
            className="flex-shrink-0 w-80 flex flex-col rounded-xl border h-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('taskId'); if (id) onDrop(id, statusId); }}
        >
            <div className="p-3 border-b flex items-center justify-between bg-white/50" style={{ borderColor: 'var(--color-border-default)' }}>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>{tasks.length}</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {mainCards.map(task => <MainCard key={task._id} task={task} onEdit={onEdit} />)}
                {subtaskCards.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-medium px-1 mt-2" style={{ color: 'var(--color-text-muted)' }}>Subtasks ({subtaskCards.length})</p>
                        {subtaskCards.map(sub => <SubCard key={sub._id} task={sub} />)}
                    </div>
                )}
                <button onClick={onNew} className="w-full flex items-center gap-2 py-1.5 px-2 text-xs font-medium rounded-md hover:bg-black/5 transition-colors mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                    <Plus size={14} /> New task
                </button>
            </div>
        </div>
    );
}

// ── Board View ────────────────────────────────────────────────────────────────

export interface TaskBoardViewProps {
    tasks: Task[];
    onEdit: (t: Task) => void;
    onNew: () => void;
    onDrop: (taskId: string, newStatus: string) => void;
}

const STATUS_IDS = ['todo', 'in-progress', 'paused', 'completed'] as const;

export const TaskBoardView: React.FC<TaskBoardViewProps> = ({ tasks, onEdit, onNew, onDrop }) => (
    <div className="flex overflow-x-auto gap-4 pb-4 h-[calc(100vh-280px)] min-h-[500px]">
        {STATUS_IDS.map(statusId => (
            <BoardColumn
                key={statusId}
                title={STATUS_LABELS[statusId]}
                statusId={statusId}
                tasks={tasks.filter(t => t.status === statusId)}
                onEdit={onEdit}
                onNew={onNew}
                onDrop={onDrop}
            />
        ))}
    </div>
);
