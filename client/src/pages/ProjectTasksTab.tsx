import { useParams } from 'react-router-dom';
import {
    useGetTasksQuery,
    useCreateTaskMutation,
    useUpdateTaskMutation,
    useDeleteTaskMutation,
    useGetSubtasksQuery,
} from '@/features/project';
import type { Task } from '@/features/project';
import { useState } from 'react';
import { Plus, Loader2, ListTodo, X, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

const statusStyles: Record<string, { bg: string; text: string }> = {
    todo: { bg: 'var(--color-bg-subtle)', text: 'var(--color-text-secondary)' },
    'in-progress': { bg: 'var(--color-info-soft)', text: 'var(--color-info)' },
    review: { bg: 'var(--color-warning-soft)', text: '#92400E' },
    completed: { bg: 'var(--color-success-soft)', text: 'var(--color-success)' },
    blocked: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)' },
};

const priorityStyles: Record<string, { bg: string; text: string }> = {
    critical: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)' },
    high: { bg: '#FFF7ED', text: '#EA580C' },
    medium: { bg: 'var(--color-warning-soft)', text: '#92400E' },
    low: { bg: 'var(--color-success-soft)', text: 'var(--color-success)' },
};

export default function ProjectTasksTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    const { data, isLoading } = useGetTasksQuery({ projectId: projectId! });
    const tasks = data?.data || [];
    const mainTasks = tasks.filter(t => !t.parentTaskId);

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
                <button
                    onClick={() => { setEditingTask(null); setShowForm(true); }}
                    className="flex items-center gap-1.5 px-3.5 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                >
                    <Plus size={15} />
                    New Task
                </button>
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
                        <button onClick={() => { setShowForm(false); setEditingTask(null); }} className="p-1" style={{ color: 'var(--color-text-muted)' }}>
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

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
                                <select name="status" defaultValue={editingTask?.status || 'todo'} className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle}>
                                    <option value="todo">To Do</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="review">Review</option>
                                    <option value="completed">Completed</option>
                                    <option value="blocked">Blocked</option>
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
                                onClick={() => { setShowForm(false); setEditingTask(null); }}
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

            {/* Task List */}
            <div className="space-y-2">
                {mainTasks.map((task) => (
                    <TaskCard
                        key={task._id}
                        task={task}
                        projectId={projectId!}
                        isExpanded={expandedTask === task._id}
                        onToggle={() => setExpandedTask(expandedTask === task._id ? null : task._id)}
                        onEdit={(t) => { setEditingTask(t); setShowForm(true); }}
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
            className="rounded-lg border transition-all"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
            }}
        >
            <div className="p-4">
                <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-center gap-2">
                        <button onClick={onToggle} className="p-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {task.title}
                        </h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: sStyle.bg, color: sStyle.text }}>
                            {task.status}
                        </span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: pStyle.bg, color: pStyle.text }}>
                            {task.priority}
                        </span>
                    </div>
                </div>

                {task.description && (
                    <p className="text-xs ml-7 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {task.description}
                    </p>
                )}

                <div className="flex justify-between items-center ml-7 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <div className="flex items-center gap-3">
                        <span>{task.assignees.length} assignee{task.assignees.length !== 1 ? 's' : ''}</span>
                        {task.estimatedHours && <span>{task.estimatedHours}h est.</span>}
                        {task.deadline && <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onEdit(task)}
                            className="text-xs transition-colors"
                            style={{ color: 'var(--color-primary)' }}
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => onDelete(task._id)}
                            className="transition-colors"
                            style={{ color: 'var(--color-danger)' }}
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
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
