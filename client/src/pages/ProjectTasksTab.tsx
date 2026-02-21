import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetTasksQuery,
    useCreateTaskMutation,
    useUpdateTaskMutation,
    useDeleteTaskMutation,
    useGetSubtasksQuery,
    useGetProjectByIdQuery,
    useCreateTimeLogMutation,
} from '@/features/project';
import type { Task } from '@/features/project';
import { useState, useEffect, useRef } from 'react';
import { Plus, Loader2, ListTodo, X, ChevronDown, ChevronRight, Trash2, LayoutList, Kanban, MoreVertical, FileText, CheckCircle2, Circle, Play, Pause, Square } from 'lucide-react';

const statusStyles: Record<string, { bg: string; text: string; dot: string; icon?: any }> = {
    todo: { bg: 'transparent', text: 'var(--color-text-secondary)', dot: '#9CA3AF', icon: Circle },
    'in-progress': { bg: 'transparent', text: 'var(--color-text-primary)', dot: '#3B82F6', icon: Circle },
    completed: { bg: 'transparent', text: 'var(--color-text-primary)', dot: '#10B981', icon: CheckCircle2 },
};

const priorityStyles: Record<string, { bg: string; text: string }> = {
    critical: { bg: '#7F1D1D', text: '#FCA5A5' },
    high: { bg: '#7F1D1D', text: '#FCA5A5' },
    medium: { bg: '#78350F', text: '#FCD34D' },
    low: { bg: '#14532D', text: '#86EFAC' },
};

export default function ProjectTasksTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    const { data: projectData } = useGetProjectByIdQuery(projectId!);
    const projectMembers = projectData?.data?.assignees || [];

    const { data, isLoading } = useGetTasksQuery({ projectId: projectId! });
    const tasks = data?.data || [];
    const mainTasks = tasks.filter(t => !t.parentTaskId);

    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

    const toggleAssignee = (userId: string) => {
        setSelectedAssignees(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();
    const [updateTask] = useUpdateTaskMutation();
    const [deleteTask] = useDeleteTaskMutation();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const taskData: any = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            status: formData.get('status') as string,
            priority: formData.get('priority') as string,
            deadline: formData.get('deadline') as string || undefined,
            startDate: formData.get('startDate') as string || undefined,
            estimatedHours: formData.get('estimatedHours') ? Number(formData.get('estimatedHours')) : undefined,
            assignees: selectedAssignees,
        };

        try {
            if (editingTask) {
                await updateTask({
                    projectId: projectId!,
                    taskId: editingTask._id,
                    data: taskData,
                }).unwrap();
            } else {
                await createTask({ projectId: projectId!, data: taskData }).unwrap();
            }
            setShowForm(false);
            setEditingTask(null);
        } catch (error) {
            console.error('Failed to save task:', error);
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm('Delete this task?')) return;
        try {
            await deleteTask({ projectId: projectId!, taskId }).unwrap();
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={16} className="animate-spin" />
                    Loading tasks...
                </div>
            </div>
        );
    }

    // Input style helper
    const inputStyle = {
        height: '36px',
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Tasks
                    <span
                        className="ml-2 text-[11px] font-normal px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                    >
                        {mainTasks.length}
                    </span>
                </h2>
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center p-0.5 rounded-lg border"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}
                    >
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'list' ? 'shadow-sm' : ''}`}
                            style={{
                                backgroundColor: viewMode === 'list' ? 'var(--color-bg-surface)' : 'transparent',
                                color: viewMode === 'list' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            }}
                        >
                            <LayoutList size={14} /> List
                        </button>
                        <button
                            onClick={() => setViewMode('board')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'board' ? 'shadow-sm' : ''}`}
                            style={{
                                backgroundColor: viewMode === 'board' ? 'var(--color-bg-surface)' : 'transparent',
                                color: viewMode === 'board' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            }}
                        >
                            <Kanban size={14} /> Board
                        </button>
                    </div>

                    <button
                        onClick={() => { setEditingTask(null); setSelectedAssignees([]); setShowForm(true); }}
                        className="flex items-center gap-1.5 px-3.5 text-sm font-medium text-white rounded-lg transition-colors"
                        style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                    >
                        <Plus size={15} />
                        New Task
                    </button>
                </div>
            </div>

            {/* Task Form */}
            {showForm && (
                <div
                    className="p-5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {editingTask ? 'Edit Task' : 'New Task'}
                        </h3>
                        <button
                            onClick={() => { setShowForm(false); setEditingTask(null); setSelectedAssignees([]); }}
                            className="p-1" style={{ color: 'var(--color-text-muted)' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Title *</label>
                            <input
                                type="text"
                                name="title"
                                defaultValue={editingTask?.title}
                                required
                                className="w-full px-3 rounded-lg border text-sm outline-none"
                                style={inputStyle}
                                placeholder="Task title"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
                            <textarea
                                name="description"
                                defaultValue={editingTask?.description}
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                                placeholder="What needs to be done?"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Assignees</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedAssignees.map(userId => {
                                    const assigneeData = projectMembers.find((m: any) =>
                                        (typeof m.userId === 'object' ? m.userId._id : m.userId) === userId
                                    );
                                    const name = assigneeData && typeof assigneeData.userId === 'object'
                                        ? (assigneeData.userId as any).name
                                        : 'User';

                                    return (
                                        <div key={userId} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                            <span>{name}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleAssignee(userId)}
                                                className="hover:bg-blue-100 rounded p-0.5"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="relative border rounded-lg max-h-40 overflow-y-auto mt-1" style={{ borderColor: 'var(--color-border-default)' }}>
                                {projectMembers.length === 0 ? (
                                    <div className="p-3 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                                        No team members in this project.
                                    </div>
                                ) : (
                                    projectMembers.map((member: any) => {
                                        const userId = typeof member.userId === 'object' ? member.userId._id : member.userId;
                                        const name = typeof member.userId === 'object' ? (member.userId as any).name : 'User';
                                        const isSelected = selectedAssignees.includes(userId);

                                        return (
                                            <div
                                                key={userId}
                                                onClick={() => toggleAssignee(userId)}
                                                className={`flex items-center gap-2 p-2.5 cursor-pointer text-sm border-b last:border-0 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                                                style={{ borderColor: 'var(--color-border-default)' }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    readOnly
                                                    checked={isSelected}
                                                    className="rounded border-gray-300 pointer-events-none"
                                                />
                                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-medium">
                                                    {name.charAt(0)}
                                                </div>
                                                <div style={{ color: 'var(--color-text-primary)' }}>
                                                    {name}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
                                <select name="status" defaultValue={editingTask?.status || 'todo'} className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle}>
                                    <option value="todo">To Do</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Priority</label>
                                <select name="priority" defaultValue={editingTask?.priority || 'medium'} className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Start Date</label>
                                <input type="date" name="startDate" defaultValue={editingTask?.startDate?.toString().split('T')[0]} className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Deadline</label>
                                <input type="date" name="deadline" defaultValue={editingTask?.deadline?.toString().split('T')[0]} className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Estimated Hours</label>
                                <input type="number" name="estimatedHours" defaultValue={editingTask?.estimatedHours} min={0} step={0.5} className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} placeholder="0" />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="flex items-center gap-1.5 px-4 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                                style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}
                            >
                                {isCreating && <Loader2 size={14} className="animate-spin" />}
                                {editingTask ? 'Update' : 'Create'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setEditingTask(null); setSelectedAssignees([]); }}
                                className="px-4 text-sm font-medium rounded-lg border transition-colors"
                                style={{
                                    height: '36px',
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Task Views */}
            {viewMode === 'list' ? (
                <div className="space-y-2">
                    {/* List View Details Table Header */}
                    {mainTasks.length > 0 && (
                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium border-b" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)' }}>
                            <div className="col-span-5 flex items-center gap-2">Task name</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Assignee</div>
                            <div className="col-span-1">Due</div>
                            <div className="col-span-1">Priority</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>
                    )}

                    {mainTasks.map((task) => (
                        <TaskCard
                            key={task._id}
                            task={task}
                            projectId={projectId!}
                            isExpanded={expandedTask === task._id}
                            onToggle={() => setExpandedTask(expandedTask === task._id ? null : task._id)}
                            onEdit={(t) => {
                                setEditingTask(t);
                                setSelectedAssignees(t.assignees.map(a => typeof a === 'string' ? a : typeof a === 'object' && 'userId' in a ? (typeof (a as any).userId === 'object' ? (a as any).userId._id : (a as any).userId) : (typeof a === 'object' ? a._id : a)) as string[]);
                                setShowForm(true);
                            }}
                            onDelete={handleDelete}
                        />
                    ))}

                    {mainTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                                style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                            >
                                <ListTodo size={20} />
                            </div>
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No tasks yet</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Create your first task to get started</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex overflow-x-auto gap-4 pb-4 h-[calc(100vh-280px)] min-h-[500px]">
                    <BoardColumn
                        title="To Do"
                        statusId="todo"
                        tasks={mainTasks.filter(t => t.status === 'todo')}
                        onEdit={(t) => {
                            setEditingTask(t);
                            setSelectedAssignees(t.assignees.map(a => typeof a === 'string' ? a : typeof a === 'object' && 'userId' in a ? (typeof (a as any).userId === 'object' ? (a as any).userId._id : (a as any).userId) : (typeof a === 'object' ? a._id : a)) as string[]);
                            setShowForm(true);
                        }}
                        onNew={() => { setEditingTask(null); setShowForm(true); }}
                        onDrop={(taskId, newStatus) => updateTask({ projectId: projectId!, taskId, data: { status: newStatus as 'todo' | 'in-progress' | 'completed' } })}
                    />
                    <BoardColumn
                        title="In Progress"
                        statusId="in-progress"
                        tasks={mainTasks.filter(t => t.status === 'in-progress')}
                        onEdit={(t) => {
                            setEditingTask(t);
                            setSelectedAssignees(t.assignees.map(a => typeof a === 'string' ? a : typeof a === 'object' && 'userId' in a ? (typeof (a as any).userId === 'object' ? (a as any).userId._id : (a as any).userId) : (typeof a === 'object' ? a._id : a)) as string[]);
                            setShowForm(true);
                        }}
                        onNew={() => { setEditingTask(null); setShowForm(true); }}
                        onDrop={(taskId, newStatus) => updateTask({ projectId: projectId!, taskId, data: { status: newStatus as 'todo' | 'in-progress' | 'completed' } })}
                    />
                    <BoardColumn
                        title="Completed"
                        statusId="completed"
                        tasks={mainTasks.filter(t => t.status === 'completed')}
                        onEdit={(t) => {
                            setEditingTask(t);
                            setSelectedAssignees(t.assignees.map(a => typeof a === 'string' ? a : typeof a === 'object' && 'userId' in a ? (typeof (a as any).userId === 'object' ? (a as any).userId._id : (a as any).userId) : (typeof a === 'object' ? a._id : a)) as string[]);
                            setShowForm(true);
                        }}
                        onNew={() => { setEditingTask(null); setShowForm(true); }}
                        onDrop={(taskId, newStatus) => updateTask({ projectId: projectId!, taskId, data: { status: newStatus as 'todo' | 'in-progress' | 'completed' } })}
                    />
                </div>
            )}
        </div>
    );
}

function TaskCard({
    task,
    projectId,
    isExpanded,
    onToggle,
    onEdit,
    onDelete,
}: {
    task: Task;
    projectId: string;
    isExpanded: boolean;
    onToggle: () => void;
    onEdit: (t: Task) => void;
    onDelete: (id: string) => void;
}) {
    const sStyle = statusStyles[task.status] || statusStyles.todo;
    const pStyle = priorityStyles[task.priority] || priorityStyles.medium;

    const { data: subtasksData } = useGetSubtasksQuery(
        { projectId, taskId: task._id },
        { skip: !isExpanded }
    );
    const subtasks = subtasksData?.data || [];

    return (
        <div
            className="border-b transition-all hover:bg-black/5 group cursor-pointer"
            style={{ borderColor: 'var(--color-border-default)' }}
            onClick={() => onEdit(task)}
        >
            <div className="grid grid-cols-12 gap-4 px-4 py-2.5 items-center">
                {/* Task Name */}
                <div className="col-span-5 flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-text-muted)' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <FileText size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <h3 className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {task.title}
                    </h3>
                </div>

                {/* Status */}
                <div className="col-span-2 flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--color-border-default)', backgroundColor: sStyle.bg }}>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sStyle.dot }}></div>
                        <span className="text-[11px] font-medium capitalize" style={{ color: sStyle.text }}>{task.status.replace('-', ' ')}</span>
                    </div>
                </div>

                {/* Assignee */}
                <div className="col-span-2 flex flex-wrap items-center gap-1.5 overflow-hidden max-h-12 py-1">
                    {task.assignees.length > 0 ? (
                        task.assignees.map((assignee, index) => {
                            const name = typeof assignee === 'object' && 'userId' in assignee ? (typeof (assignee as any).userId === 'object' ? (assignee as any).userId.name : 'User') : 'User';
                            return (
                                <div key={index} className="flex items-center gap-1 pr-1.5 bg-black/5 rounded-full shrink-0">
                                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-medium text-blue-700 shrink-0">
                                        {name.charAt(0)}
                                    </div>
                                    <span className="text-[10px] font-medium truncate max-w-[60px]" style={{ color: 'var(--color-text-secondary)' }} title={name}>
                                        {name}
                                    </span>
                                </div>
                            );
                        })
                    ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>
                    )}
                </div>

                {/* Due Date */}
                <div className="col-span-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                </div>

                {/* Priority */}
                <div className="col-span-1">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: pStyle.bg, color: pStyle.text }}>
                        {task.priority}
                    </span>
                </div>

                {/* Actions: Timer + Edit/Delete */}
                <div className="col-span-1 flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TaskTimerButtons task={task} projectId={projectId} />
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
                        className="transition-colors hover:bg-black/5 p-1 rounded"
                        style={{ color: 'var(--color-danger)' }}
                    >
                        <Trash2 size={13} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                        className="transition-colors hover:bg-black/5 p-1 rounded"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        <MoreVertical size={13} />
                    </button>
                </div>
            </div>

            {/* Subtasks */}
            {isExpanded && (
                <div
                    className="border-t px-4 py-3"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                >
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Subtasks ({subtasks.length})
                    </p>
                    {subtasks.map((sub: Task) => {
                        const subStatus = statusStyles[sub.status] || statusStyles.todo;
                        return (
                            <div
                                key={sub._id}
                                className="flex items-center justify-between py-1.5 px-2 rounded text-xs"
                            >
                                <span style={{ color: 'var(--color-text-primary)' }}>{sub.title}</span>
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize" style={{ backgroundColor: subStatus.bg, color: subStatus.text }}>
                                    {sub.status}
                                </span>
                            </div>
                        );
                    })}
                    {subtasks.length === 0 && (
                        <p className="text-xs py-2 text-center" style={{ color: 'var(--color-text-muted)' }}>
                            No subtasks
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Task Timer Buttons ──────────────────────────────────────────────────────
// Shown on tasks that the current user is assigned to.
// State is persisted in localStorage so page refresh doesn't lose the timer.
const TIMER_KEY = (taskId: string) => `cuos_timer_${taskId}`;

function TaskTimerButtons({ task, projectId }: { task: Task; projectId: string }) {
    const currentUser = useSelector((s: RootState) => s.auth.user);
    const userId = currentUser?._id;

    // Check if current user is an assignee
    const isAssigned = task.assignees.some(a => {
        if (typeof a === 'string') return a === userId;
        if (typeof a === 'object' && 'userId' in a) {
            const uid = (a as any).userId;
            return typeof uid === 'object' ? uid._id === userId : uid === userId;
        }
        if (typeof a === 'object' && '_id' in a) return (a as any)._id === userId;
        return false;
    });

    const [createTimeLog] = useCreateTimeLogMutation();
    const [updateTask] = useUpdateTaskMutation();
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load persisted timer on mount
    const stored = (() => { try { return JSON.parse(localStorage.getItem(TIMER_KEY(task._id)) || 'null'); } catch { return null; } })();
    const [running, setRunning] = useState<boolean>(!!stored?.startedAt);
    const startedAtRef = useRef<number>(stored?.startedAt || 0);
    const accumulatedRef = useRef<number>(stored?.accumulated || 0); // seconds already paused

    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => {
                setElapsed(accumulatedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000));
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [running]);

    if (!isAssigned || !userId) return null;

    const fmtElapsed = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const handleStart = async () => {
        const now = Date.now();
        startedAtRef.current = now;
        localStorage.setItem(TIMER_KEY(task._id), JSON.stringify({ startedAt: now, accumulated: accumulatedRef.current }));
        setRunning(true);
        // Move task to in-progress if not already
        if (task.status === 'todo') {
            try { await updateTask({ projectId, taskId: task._id, data: { status: 'in-progress' } }).unwrap(); } catch { /* ignore */ }
        }
    };

    const handlePause = async () => {
        const sessionSecs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        const totalSecs = accumulatedRef.current + sessionSecs;
        accumulatedRef.current = totalSecs;
        localStorage.setItem(TIMER_KEY(task._id), JSON.stringify({ startedAt: 0, accumulated: totalSecs }));
        setRunning(false);
        // Log time if at least 1 minute
        const mins = Math.max(1, Math.round(totalSecs / 60));
        try {
            await createTimeLog({
                projectId,
                taskId: task._id,
                data: { date: new Date().toISOString().split('T')[0], duration: mins, description: 'Paused session' },
            }).unwrap();
        } catch { /* ignore */ }
    };

    const handleComplete = async () => {
        const sessionSecs = running ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0;
        const totalSecs = accumulatedRef.current + sessionSecs;
        setRunning(false);
        localStorage.removeItem(TIMER_KEY(task._id));
        accumulatedRef.current = 0;
        setElapsed(0);
        // Log time
        const mins = Math.max(1, Math.round(totalSecs / 60));
        try {
            await createTimeLog({
                projectId,
                taskId: task._id,
                data: { date: new Date().toISOString().split('T')[0], duration: mins, description: 'Task completed' },
            }).unwrap();
        } catch { /* ignore */ }
        // Mark task completed
        try { await updateTask({ projectId, taskId: task._id, data: { status: 'completed' } }).unwrap(); } catch { /* ignore */ }
    };

    return (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {running && (
                <span className="text-[11px] tabular-nums font-mono font-medium px-2 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--color-success-soft, rgba(16,185,129,0.1))', color: 'var(--color-success)' }}>
                    {fmtElapsed(elapsed)}
                </span>
            )}
            {!running ? (
                <button onClick={handleStart} title="Start task"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white transition-colors"
                    style={{ backgroundColor: 'var(--color-success)' }}>
                    <Play size={11} fill="white" /> Start
                </button>
            ) : (
                <button onClick={handlePause} title="Pause & log"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white"
                    style={{ backgroundColor: '#f59e0b' }}>
                    <Pause size={11} fill="white" /> Pause
                </button>
            )}
            {task.status !== 'completed' && (
                <button onClick={handleComplete} title="Mark complete & log"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}>
                    <Square size={11} fill="white" /> Done
                </button>
            )}
        </div>
    );
}

function BoardColumn({
    title,
    statusId,
    tasks,
    onEdit,
    onNew,
    onDrop,
}: {
    title: string;
    statusId: string;
    tasks: Task[];
    onEdit: (t: Task) => void;
    onNew: () => void;
    onDrop: (taskId: string, newStatus: string) => void;
}) {
    const dotColor = statusStyles[statusId]?.dot || '#9CA3AF';
    return (
        <div
            className="flex-shrink-0 w-80 flex flex-col rounded-xl border h-full overflow-hidden"
            style={{
                backgroundColor: 'var(--color-bg-subtle)',
                borderColor: 'var(--color-border-default)'
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('taskId');
                if (taskId) {
                    onDrop(taskId, statusId);
                }
            }}
        >
            <div className="p-3 border-b flex items-center justify-between bg-white/50" style={{ borderColor: 'var(--color-border-default)' }}>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }}></div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
                    <span
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}
                    >
                        {tasks.length}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {tasks.map((task) => (
                    <div
                        key={task._id}
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
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                                style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-subtle)' }}
                            >
                                <MoreVertical size={14} />
                            </button>
                        </div>

                        {task.description && (
                            <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                                {task.description}
                            </p>
                        )}

                        <div className="flex flex-col gap-2 pt-2 mt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="flex flex-wrap gap-1.5">
                                {task.assignees.length > 0 ? (
                                    task.assignees.map((assignee, i) => {
                                        const name = typeof assignee === 'object' && 'userId' in assignee ? (typeof (assignee as any).userId === 'object' ? (assignee as any).userId.name : 'User') : 'User';
                                        return (
                                            <div key={i} className="flex items-center gap-1 pr-1.5 bg-black/5 rounded-full shrink-0">
                                                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-medium text-blue-700 shrink-0">
                                                    {name.charAt(0)}
                                                </div>
                                                <span className="text-[10px] font-medium truncate max-w-[60px]" style={{ color: 'var(--color-text-secondary)' }} title={name}>
                                                    {name}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>
                                )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-medium pb-1" style={{ color: 'var(--color-text-muted)' }}>
                                {task.deadline ? (
                                    <span>{new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                ) : <span></span>}
                                <span className="px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: priorityStyles[task.priority]?.bg || '#f3f4f6', color: priorityStyles[task.priority]?.text || '#4b5563' }}>
                                    {task.priority}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    onClick={onNew}
                    className="w-full flex items-center gap-2 py-1.5 px-2 text-xs font-medium rounded-md hover:bg-black/5 transition-colors mt-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    <Plus size={14} /> New task
                </button>


            </div>
        </div>
    );
}
