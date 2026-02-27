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
    useCreateSubtaskMutation,
} from '@/features/project';
import type { Task } from '@/features/project';
import { useState, useRef, useEffect } from 'react';
import { Plus, Loader2, ListTodo, X, ChevronDown, ChevronRight, Trash2, LayoutList, Kanban, MoreVertical, FileText, CheckCircle2, Circle, Pause, Pencil, Clock, Lock } from 'lucide-react';

const statusStyles: Record<string, { bg: string; text: string; dot: string; icon?: any }> = {
    todo: { bg: 'transparent', text: 'var(--color-text-secondary)', dot: '#9CA3AF', icon: Circle },
    'in-progress': { bg: 'transparent', text: 'var(--color-text-primary)', dot: '#3B82F6', icon: Circle },
    paused: { bg: 'transparent', text: '#D97706', dot: '#F59E0B', icon: Pause },
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
    const currentUser = useSelector((s: RootState) => s.auth.user);
    const currentUserId = (currentUser as any)?._id || (currentUser as any)?.id;

    // Determine if the current user is a super admin
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? (currentUser.role as any).name?.toLowerCase()
            : String(currentUser.role).toLowerCase()
        : '';
    const isSuperAdmin = ['super-admin', 'super_admin', 'admin'].includes(roleName);

    const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
    // Super admin always sees all tasks; team starts on 'my' tasks
    const [taskFilter, setTaskFilter] = useState<'all' | 'my'>(isSuperAdmin ? 'all' : 'my');
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const { data: projectData } = useGetProjectByIdQuery(projectId!);
    const projectMembers = projectData?.data?.assignees || [];

    const { data, isLoading } = useGetTasksQuery({ projectId: projectId! });
    const tasks = data?.data || [];

    // Board view: fetch all tasks including subtasks so subtasks appear as cards
    const { data: boardAllData } = useGetTasksQuery(
        { projectId: projectId!, includeSubtasks: true },
        { skip: viewMode !== 'board' }
    );
    const allBoardTasks = boardAllData?.data || [];
    const filteredBoardTasks = isSuperAdmin || taskFilter === 'all'
        ? allBoardTasks
        : allBoardTasks.filter(t =>
            t.assignees.some((a: any) => {
                const uid = typeof a === 'object' ? (a._id || a.id) : a;
                return uid === currentUserId;
            })
        );

    // Filter tasks based on selected tab (super admin always sees all)
    const filteredTasks = isSuperAdmin || taskFilter === 'all'
        ? tasks
        : tasks.filter(t => {
            const assignees = t.assignees || [];
            return assignees.some((a: any) => {
                const uid = typeof a === 'object' ? (a._id || a.id) : a;
                return uid === currentUserId;
            });
        });

    const mainTasks = filteredTasks.filter(t => !t.parentTaskId);

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
            {/* Task Filter Tabs — hidden for super admin */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    {isSuperAdmin ? (
                        /* Super admin: no tabs, just a plain header label */
                        <div
                            className="px-4 py-2.5 text-sm font-medium border-b-2"
                            style={{
                                color: 'var(--color-primary)',
                                borderColor: 'var(--color-primary)',
                                backgroundColor: 'var(--color-primary-soft)',
                                borderTopLeftRadius: 6,
                                borderTopRightRadius: 6,
                            }}
                        >
                            All Tasks
                            <span
                                className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                }}
                            >
                                {tasks.filter(t => !t.parentTaskId).length}
                            </span>
                        </div>
                    ) : (
                        /* Team member: My Tasks + All Tasks tabs */
                        <>
                            <button
                                onClick={() => setTaskFilter('my')}
                                className="px-4 py-2.5 text-sm font-medium transition-colors border-b-2"
                                style={{
                                    color: taskFilter === 'my' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    borderColor: taskFilter === 'my' ? 'var(--color-primary)' : 'transparent',
                                    backgroundColor: taskFilter === 'my' ? 'var(--color-primary-soft)' : 'transparent',
                                    borderTopLeftRadius: 6,
                                    borderTopRightRadius: 6,
                                }}
                            >
                                My Tasks
                                <span
                                    className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full"
                                    style={{
                                        backgroundColor: taskFilter === 'my' ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                                        color: taskFilter === 'my' ? 'white' : 'var(--color-text-muted)',
                                    }}
                                >
                                    {tasks.filter(t => !t.parentTaskId && t.assignees.some((a: any) => {
                                        const uid = typeof a === 'object' ? (a._id || a.id) : a;
                                        return uid === currentUserId;
                                    })).length}
                                </span>
                            </button>
                            <button
                                onClick={() => setTaskFilter('all')}
                                className="px-4 py-2.5 text-sm font-medium transition-colors border-b-2"
                                style={{
                                    color: taskFilter === 'all' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    borderColor: taskFilter === 'all' ? 'var(--color-primary)' : 'transparent',
                                    backgroundColor: taskFilter === 'all' ? 'var(--color-primary-soft)' : 'transparent',
                                    borderTopLeftRadius: 6,
                                    borderTopRightRadius: 6,
                                }}
                            >
                                All Tasks
                                <span
                                    className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full"
                                    style={{
                                        backgroundColor: taskFilter === 'all' ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                                        color: taskFilter === 'all' ? 'white' : 'var(--color-text-muted)',
                                    }}
                                >
                                    {tasks.filter(t => !t.parentTaskId).length}
                                </span>
                            </button>
                        </>
                    )}
                </div>

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

            {/* ── Task Create / Edit Modal ────────────────────────── */}
            {showForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowForm(false); setEditingTask(null); setSelectedAssignees([]); } }}
                >
                    <div
                        className="w-full max-w-xl rounded-xl shadow-2xl flex flex-col overflow-hidden"
                        style={{ backgroundColor: 'var(--color-bg-surface)', maxHeight: '90vh' }}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {editingTask ? 'Edit Task' : 'New Task'}
                            </h3>
                            <button
                                onClick={() => { setShowForm(false); setEditingTask(null); setSelectedAssignees([]); }}
                                className="p-1.5 rounded-md hover:bg-black/5 transition-colors"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto flex-1 p-5">
                            <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Title *</label>
                                    <input
                                        type="text"
                                        name="title"
                                        defaultValue={editingTask?.title}
                                        required
                                        autoFocus
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
                                        rows={3}
                                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            backgroundColor: 'var(--color-bg-surface)',
                                            color: 'var(--color-text-primary)',
                                        }}
                                        placeholder="What needs to be done?"
                                    />
                                </div>

                                {/* Assignees */}
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Assignees</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {selectedAssignees.map(userId => {
                                            const assigneeData = projectMembers.find((m: any) => {
                                                const empId = typeof m.employeeId === 'object' ? m.employeeId : null;
                                                const uid = empId ? (typeof empId.userId === 'object' ? empId.userId._id : empId.userId) : (typeof m.userId === 'object' ? m.userId._id : m.userId);
                                                return uid === userId;
                                            });
                                            const empId = assigneeData?.employeeId;
                                            const name = (typeof empId === 'object' && typeof empId?.userId === 'object')
                                                ? (empId.userId as any).name
                                                : ((typeof assigneeData?.userId === 'object') ? (assigneeData.userId as any).name : 'User');
                                            return (
                                                <div key={userId} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                                                    <span>{name}</span>
                                                    <button type="button" onClick={() => toggleAssignee(userId)} className="rounded p-0.5 hover:bg-black/10">
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="border rounded-lg max-h-36 overflow-y-auto" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {projectMembers.length === 0 ? (
                                            <div className="p-3 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>No team members in this project.</div>
                                        ) : (
                                            projectMembers.map((member: any) => {
                                                const empId = typeof member.employeeId === 'object' ? member.employeeId : null;
                                                const userId = empId
                                                    ? (typeof empId.userId === 'object' ? empId.userId._id : empId.userId)
                                                    : (typeof member.userId === 'object' ? member.userId._id : member.userId);
                                                const name = empId && typeof empId.userId === 'object'
                                                    ? (empId.userId as any).name
                                                    : (typeof member.userId === 'object' ? (member.userId as any).name : 'User');
                                                const isSelected = selectedAssignees.includes(userId);
                                                return (
                                                    <div
                                                        key={userId}
                                                        onClick={() => toggleAssignee(userId)}
                                                        className={`flex items-center gap-2 p-2.5 cursor-pointer text-sm border-b last:border-0 transition-colors ${isSelected ? '' : 'hover:bg-black/[0.03]'}`}
                                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'transparent' }}
                                                    >
                                                        <input type="checkbox" readOnly checked={isSelected} className="rounded border-gray-300 pointer-events-none" />
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-bg-subtle)', color: isSelected ? 'white' : 'var(--color-text-muted)' }}>
                                                            {name.charAt(0)}
                                                        </div>
                                                        <span style={{ color: 'var(--color-text-primary)' }}>{name}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Status / Priority / Dates */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
                                        <select name="status" defaultValue={editingTask?.status || 'todo'} className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle}>
                                            <option value="todo">To Do</option>
                                            <option value="in-progress">In Progress</option>
                                            <option value="paused">Paused</option>
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
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Estimated Hours</label>
                                        <input type="number" name="estimatedHours" defaultValue={editingTask?.estimatedHours} min={0} step={0.5} className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} placeholder="0" />
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-5 py-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setEditingTask(null); setSelectedAssignees([]); }}
                                className="px-4 text-sm font-medium rounded-lg border transition-colors"
                                style={{ height: '36px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="task-form"
                                disabled={isCreating}
                                className="flex items-center gap-1.5 px-5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                                style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}
                            >
                                {isCreating && <Loader2 size={14} className="animate-spin" />}
                                {editingTask ? 'Update Task' : 'Create Task'}
                            </button>
                        </div>
                    </div>
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
                            filterMode={taskFilter}
                            onEdit={(t) => {
                                setEditingTask(t);
                                setSelectedAssignees(t.assignees.map(a => typeof a === 'string' ? a : typeof a === 'object' && 'userId' in a ? (typeof (a as any).userId === 'object' ? (a as any).userId._id : (a as any).userId) : (typeof a === 'object' ? (a as any)._id || (a as any).id : a)) as string[]);
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
                    {(['todo', 'in-progress', 'paused', 'completed'] as const).map((statusId) => {
                        const titles: Record<string, string> = {
                            'todo': 'To Do',
                            'in-progress': 'In Progress',
                            'paused': 'Paused',
                            'completed': 'Completed',
                        };
                        return (
                            <BoardColumn
                                key={statusId}
                                title={titles[statusId]}
                                statusId={statusId}
                                tasks={filteredBoardTasks.filter(t => t.status === statusId)}
                                onEdit={(t) => {
                                    setEditingTask(t);
                                    setSelectedAssignees(t.assignees.map(a => typeof a === 'string' ? a : typeof a === 'object' && 'userId' in a ? (typeof (a as any).userId === 'object' ? (a as any).userId._id : (a as any).userId) : (typeof a === 'object' ? a._id : a)) as string[]);
                                    setShowForm(true);
                                }}
                                onNew={() => { setEditingTask(null); setShowForm(true); }}
                                onDrop={(taskId, newStatus) => {
                                    // Enforce assignee gate: only assignees (or super-admins) can move cards
                                    const droppedTask = filteredBoardTasks.find(t => t._id === taskId);
                                    if (!droppedTask) return;
                                    const isAssignee = droppedTask.assignees.some((a: any) => {
                                        const uid = typeof a === 'object' ? (a._id || a.id) : a;
                                        return uid === currentUserId;
                                    });
                                    if (!isSuperAdmin && !isAssignee) return;
                                    updateTask({ projectId: projectId!, taskId, data: { status: newStatus as any } });
                                }}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function TaskCard({
    task,
    projectId,
    filterMode,
    onEdit,
    onDelete,
}: {
    task: Task;
    projectId: string;
    filterMode: 'all' | 'my';
    onEdit: (t: Task) => void;
    onDelete: (id: string) => void;
}) {
    const currentUser = useSelector((s: RootState) => s.auth.user);
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? (currentUser.role as any).name?.toLowerCase()
            : String(currentUser.role).toLowerCase()
        : '';
    const isSuperAdmin = ['super-admin', 'super_admin'].includes(roleName);

    const { data: projectData } = useGetProjectByIdQuery(projectId);
    const project = projectData?.data;
    const currentUserId = (currentUser as any)?._id || (currentUser as any)?.id;

    const [isExpanded, setIsExpanded] = useState(false);

    const isProjectManager = isSuperAdmin || (() => {
        if (!project || !currentUserId) return false;
        const assignee = project.assignees.find((a: any) => {
            const empId = typeof a.employeeId === 'object' ? a.employeeId : null;
            const uid = empId && typeof empId.userId === 'object' ? empId.userId._id : empId?.userId;
            return uid === currentUserId;
        });
        return assignee?.role === 'manager';
    })();

    const pStyle = priorityStyles[task.priority] || priorityStyles.medium;

    const { data: subtasksData, refetch: refetchSubtasks } = useGetSubtasksQuery(
        { projectId, taskId: task._id },
        { skip: !isExpanded }
    );
    const allSubtasks = subtasksData?.data || [];

    // Filter subtasks if in 'My Tasks' mode
    const subtasks = filterMode === 'my'
        ? allSubtasks.filter((sub: Task) => sub.assignees.some((a: any) => {
            const uid = typeof a === 'object' ? (a._id || a.id) : a;
            return uid === currentUserId;
        }))
        : allSubtasks;

    // Use the aggregated count from the backend when the panel is collapsed
    // (subtasks query is skipped), fall back to live array when expanded.
    const displaySubtaskCount = subtasks.length > 0 ? subtasks.length : (task.subtaskCount ?? 0);

    // ── Subtask creation state ─────────────────────────────────────────────────
    const [showSubtaskForm, setShowSubtaskForm] = useState(false);
    const [subSelectedAssignees, setSubSelectedAssignees] = useState<string[]>([]);
    const [createSubtask, { isLoading: isCreatingSubtask }] = useCreateSubtaskMutation();
    const [updateTask, { isLoading: isUpdatingSubtask }] = useUpdateTaskMutation();

    // ── Subtask editing state ──────────────────────────────────────────────────
    const [editingSubtask, setEditingSubtask] = useState<Task | null>(null);
    const [subEditAssignees, setSubEditAssignees] = useState<string[]>([]);

    const openSubtaskEdit = (sub: Task) => {
        setEditingSubtask(sub);
        setSubEditAssignees(sub.assignees.map((a: any) => (a as any)._id || (a as any).id || a));
    };
    const closeSubtaskEdit = () => { setEditingSubtask(null); setSubEditAssignees([]); };

    const toggleSubAssignee = (uid: string) => {
        setSubSelectedAssignees(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
    };
    const toggleSubEditAssignee = (uid: string) => {
        setSubEditAssignees(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
    };

    const handleSubtaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        try {
            await createSubtask({
                projectId,
                taskId: task._id,
                data: {
                    title: fd.get('title') as string,
                    status: (fd.get('status') as any) || 'todo',
                    priority: (fd.get('priority') as any) || 'medium',
                    deadline: (fd.get('deadline') as string) || undefined,
                    assignees: subSelectedAssignees,
                },
            }).unwrap();
            setShowSubtaskForm(false);
            setSubSelectedAssignees([]);
            refetchSubtasks();
        } catch (err) {
            console.error('Failed to create subtask:', err);
        }
    };

    const handleSubtaskUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingSubtask) return;
        const fd = new FormData(e.currentTarget);
        try {
            await updateTask({
                projectId,
                taskId: editingSubtask._id,
                data: {
                    title: fd.get('title') as string,
                    description: (fd.get('description') as string) || '',
                    status: (fd.get('status') as any) || editingSubtask.status,
                    priority: (fd.get('priority') as any) || editingSubtask.priority,
                    deadline: (fd.get('deadline') as string) || undefined,
                    assignees: subEditAssignees,
                },
            }).unwrap();
            closeSubtaskEdit();
            refetchSubtasks();
        } catch (err) {
            console.error('Failed to update subtask:', err);
        }
    };

    const subInputStyle = {
        height: '32px',
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
        fontSize: '12px',
    };

    const modalInputStyle = {
        height: '36px',
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return (
        <>
            <div
                className={`transition-all group cursor-pointer ${isExpanded ? 'rounded-[1rem] shadow-premium mb-4 overflow-hidden border-0' : 'border-b hover:bg-black/5'}`}
                style={{
                    borderColor: isExpanded ? 'transparent' : 'var(--color-border-default)',
                    backgroundColor: isExpanded ? 'var(--color-bg-surface)' : 'transparent'
                }}
                onClick={() => {
                    if (!isExpanded) {
                        setIsExpanded(true);
                    } else {
                        onEdit(task); // Edit on click only if already expanded, or handle differently based on UI needs. Let's make the row click toggle expansion
                        setIsExpanded(!isExpanded);
                    }
                }}
            >
                <div
                    className={`grid grid-cols-12 gap-4 px-4 py-3 items-center ${isExpanded ? 'bg-[var(--color-primary-soft)]/20 border-b border-[var(--color-border-default)]' : ''}`}
                >
                    {/* Task Name */}
                    <div className="col-span-5 flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-text-muted)' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <FileText size={14} style={{ color: 'var(--color-text-muted)' }} />
                        <h3 className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {task.title}
                        </h3>
                        {displaySubtaskCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                                {displaySubtaskCount} sub
                            </span>
                        )}
                    </div>

                    {/* Status — inline dropdown (triggers timer automation on change) */}
                    <div className="col-span-2">
                        <StatusDropdown task={task} projectId={projectId} currentUserId={currentUserId} canManage={isProjectManager} hasSubtasks={displaySubtaskCount > 0} />
                    </div>

                    {/* Assignee */}
                    <div className="col-span-2 flex flex-wrap items-center gap-1.5 overflow-hidden max-h-12 py-1">
                        {task.assignees.length > 0 ? (
                            task.assignees.map((assignee, index) => {
                                // Task assignees are populated as User objects: { _id, name, email }
                                const name = typeof assignee === 'object' && (assignee as any).name
                                    ? (assignee as any).name
                                    : (typeof assignee === 'object' && 'userId' in assignee && typeof (assignee as any).userId === 'object'
                                        ? (assignee as any).userId.name
                                        : 'User');
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

                    {/* Actions: Edit/Delete */}
                    <div className="col-span-1 flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isProjectManager && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
                                className="transition-colors hover:bg-black/5 p-1 rounded"
                                style={{ color: 'var(--color-danger)' }}
                                title="Delete task"
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                            className="transition-colors hover:bg-black/5 p-1 rounded"
                            style={{ color: 'var(--color-text-secondary)' }}
                            title="Edit task"
                        >
                            <MoreVertical size={13} />
                        </button>
                    </div>
                </div>

                {/* ── Expanded Subtasks Panel ────────────────────────────────────── */}
                {isExpanded && (
                    <div
                        className="pb-2"
                        style={{ backgroundColor: 'transparent' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Subtask List Header */}
                        <div className="flex items-center justify-between px-5 py-2.5">
                            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                                Subtasks <span className="font-normal">({subtasks.length})</span>
                            </p>
                            {!showSubtaskForm && (
                                <button
                                    onClick={() => setShowSubtaskForm(true)}
                                    className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors"
                                    style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)' }}
                                >
                                    <Plus size={11} /> Add Subtask
                                </button>
                            )}
                        </div>

                        {/* Subtask rows */}
                        {subtasks.length > 0 && (
                            <div className="space-y-2 pb-2 mt-2" style={{ borderColor: 'var(--color-border-default)' }}>
                                {subtasks.map((sub: Task) => {
                                    const subS = statusStyles[sub.status] || statusStyles.todo;
                                    const subP = priorityStyles[sub.priority] || priorityStyles.medium;
                                    return (
                                        <div
                                            key={sub._id}
                                            onClick={(e) => { e.stopPropagation(); openSubtaskEdit(sub); }}
                                            className="group/sub relative grid grid-cols-12 gap-4 items-center py-2 pr-3 rounded-[0.5rem] text-xs border cursor-pointer transition-all hover:border-[var(--color-primary)] hover:shadow-sm"
                                            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                                        >
                                            {/* Connector line for the subtask */}
                                            <div className="absolute left-[34px] top-0 bottom-1/2 border-l-2 z-0" style={{ borderColor: 'var(--color-border-default)' }} />
                                            <div className="absolute left-[34px] top-1/2 w-[22px] border-t-2 z-0" style={{ borderColor: 'var(--color-border-default)' }} />

                                            {/* Title (Col 5 to match parent Task Name) - Indented! */}
                                            <div className="col-span-12 md:col-span-5 flex items-center gap-2 relative z-10 pl-[64px]">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: subS.dot }} />
                                                <span className="flex-1 font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{sub.title}</span>
                                            </div>

                                            {/* Status — inline dropdown for subtask */}
                                            <div className="hidden md:flex col-span-2 relative z-10">
                                                <StatusDropdown task={sub} projectId={projectId} currentUserId={currentUserId} canManage={isProjectManager} size="xs" />
                                            </div>

                                            {/* Assignees (Col 2 to match parent) */}
                                            <div className="hidden md:flex flex-wrap col-span-2 items-center gap-1.5 overflow-hidden max-h-12 py-1 relative z-10">
                                                {sub.assignees.length > 0 ? (
                                                    sub.assignees.map((assignee: any, index: number) => {
                                                        const name = typeof assignee === 'object' && (assignee as any).name
                                                            ? (assignee as any).name
                                                            : (typeof assignee === 'object' && 'userId' in assignee && typeof (assignee as any).userId === 'object'
                                                                ? (assignee as any).userId.name
                                                                : 'User');
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

                                            {/* Due date (Col 1 to match parent) */}
                                            <div className="hidden md:block col-span-1 text-xs relative z-10" style={{ color: 'var(--color-text-secondary)' }}>
                                                {sub.deadline ? new Date(sub.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                                            </div>

                                            {/* Priority (Col 1 to match parent) */}
                                            <div className="hidden md:block col-span-1 relative z-10">
                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: subP.bg, color: subP.text }}>
                                                    {sub.priority}
                                                </span>
                                            </div>

                                            {/* Edit pencil (Col 1 to match parent Actions) */}
                                            <div className="hidden md:flex col-span-1 justify-end relative z-10">
                                                <Pencil size={12} className="opacity-0 group-hover/sub:opacity-60 flex-shrink-0 transition-opacity" style={{ color: 'var(--color-primary)' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {subtasks.length === 0 && !showSubtaskForm && (
                            <p className="text-xs pb-3 text-center px-4 mt-2" style={{ color: 'var(--color-text-muted)' }}>No subtasks yet</p>
                        )}

                        {/* ── Subtask Form ──────────────────────────────── */}
                        {showSubtaskForm && (
                            <form
                                onSubmit={handleSubtaskSubmit}
                                className="ml-8 mr-4 mb-3 p-3 mt-2 rounded-lg border space-y-3"
                                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                            >
                                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>New Subtask</p>

                                {/* Title */}
                                <input
                                    name="title"
                                    required
                                    autoFocus
                                    placeholder="Subtask title *"
                                    className="w-full px-2.5 rounded-md border outline-none"
                                    style={subInputStyle}
                                />

                                {/* Status / Priority / Deadline row */}
                                <div className="grid grid-cols-3 gap-2">
                                    <select name="status" defaultValue="todo" className="px-2 rounded-md border outline-none" style={subInputStyle}>
                                        <option value="todo">To Do</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="paused">Paused</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                    <select name="priority" defaultValue="medium" className="px-2 rounded-md border outline-none" style={subInputStyle}>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                    <input type="date" name="deadline" className="px-2 rounded-md border outline-none" style={subInputStyle} />
                                </div>

                                {/* Assignees mini-picker — only from this task's assigned members */}
                                {task.assignees.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                            Assign to <span style={{ fontWeight: 400 }}>(task members only)</span>
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {task.assignees.map((assignee: any) => {
                                                const uid = assignee._id || assignee.id || assignee;
                                                const mName = assignee.name || 'User';
                                                const sel = subSelectedAssignees.includes(uid);
                                                return (
                                                    <button
                                                        key={uid}
                                                        type="button"
                                                        onClick={() => toggleSubAssignee(uid)}
                                                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors"
                                                        style={{
                                                            borderColor: sel ? 'var(--color-primary)' : 'var(--color-border-default)',
                                                            backgroundColor: sel ? 'var(--color-primary-soft)' : 'var(--color-bg-subtle)',
                                                            color: sel ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                                        }}
                                                    >
                                                        <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: sel ? 'var(--color-primary)' : 'var(--color-text-muted)', color: 'white' }}>
                                                            {mName.charAt(0)}
                                                        </span>
                                                        {mName}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Form actions */}
                                <div className="flex gap-2 pt-0.5">
                                    <button
                                        type="submit"
                                        disabled={isCreatingSubtask}
                                        className="flex items-center gap-1 px-3 text-[11px] font-semibold text-white rounded-md disabled:opacity-50"
                                        style={{ height: '28px', backgroundColor: 'var(--color-primary)' }}
                                    >
                                        {isCreatingSubtask && <Loader2 size={10} className="animate-spin" />}
                                        Add
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowSubtaskForm(false); setSubSelectedAssignees([]); }}
                                        className="px-3 text-[11px] font-medium rounded-md border"
                                        style={{ height: '28px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>

            {/* ── Subtask Edit Modal ──────────────────────────────── */}
            {
                editingSubtask && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                        onClick={(e) => { if (e.target === e.currentTarget) closeSubtaskEdit(); }}
                    >
                        <div
                            className="w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden"
                            style={{ backgroundColor: 'var(--color-bg-surface)', maxHeight: '88vh' }}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Subtask of · {task.title}</p>
                                    <h3 className="text-sm font-semibold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>Edit Subtask</h3>
                                </div>
                                <button onClick={closeSubtaskEdit} className="p-1.5 rounded-md hover:bg-black/5 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="overflow-y-auto flex-1 p-5">
                                <form id="subtask-edit-form" onSubmit={handleSubtaskUpdate} className="space-y-4">

                                    {/* Title */}
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Title *</label>
                                        <input
                                            name="title"
                                            required
                                            autoFocus
                                            defaultValue={editingSubtask.title}
                                            className="w-full px-3 rounded-lg border text-sm outline-none"
                                            style={modalInputStyle}
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
                                        <textarea
                                            name="description"
                                            defaultValue={editingSubtask.description}
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                            placeholder="Optional description"
                                        />
                                    </div>

                                    {/* Status / Priority / Deadline */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
                                            <select name="status" defaultValue={editingSubtask.status} className="w-full px-3 rounded-lg border text-sm outline-none" style={modalInputStyle}>
                                                <option value="todo">To Do</option>
                                                <option value="in-progress">In Progress</option>
                                                <option value="paused">Paused</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Priority</label>
                                            <select name="priority" defaultValue={editingSubtask.priority} className="w-full px-3 rounded-lg border text-sm outline-none" style={modalInputStyle}>
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="critical">Critical</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Deadline</label>
                                            <input type="date" name="deadline" defaultValue={editingSubtask.deadline?.toString().split('T')[0]} className="w-full px-3 rounded-lg border text-sm outline-none" style={modalInputStyle} />
                                        </div>
                                    </div>

                                    {/* Assignees — only from task's members */}
                                    {task.assignees.length > 0 && (
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Assignees <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>(task members only)</span></label>
                                            <div className="flex flex-wrap gap-2">
                                                {task.assignees.map((a: any) => {
                                                    const uid = a._id || a.id;
                                                    const name = a.name || 'User';
                                                    const sel = subEditAssignees.includes(uid);
                                                    return (
                                                        <button
                                                            key={uid}
                                                            type="button"
                                                            onClick={() => toggleSubEditAssignee(uid)}
                                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                                                            style={{
                                                                borderColor: sel ? 'var(--color-primary)' : 'var(--color-border-default)',
                                                                backgroundColor: sel ? 'var(--color-primary-soft)' : 'var(--color-bg-subtle)',
                                                                color: sel ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                                            }}
                                                        >
                                                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: sel ? 'var(--color-primary)' : 'var(--color-text-muted)', color: 'white' }}>
                                                                {name.charAt(0)}
                                                            </span>
                                                            {name}
                                                            {sel && <span className="text-[10px]" style={{ color: 'var(--color-primary)' }}>✓</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-5 py-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                <button type="button" onClick={closeSubtaskEdit} className="px-4 text-sm font-medium rounded-lg border transition-colors" style={{ height: '36px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}>
                                    Cancel
                                </button>
                                <button type="submit" form="subtask-edit-form" disabled={isUpdatingSubtask} className="flex items-center gap-1.5 px-5 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}>
                                    {isUpdatingSubtask && <Loader2 size={14} className="animate-spin" />}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}

// ─── Live Session Timer ───────────────────────────────────────────────────────
// Counts up from startedAt.  baseSeconds = total accumulated time in seconds
// from previous sessions so the display continues from where the user last paused.
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

    // total = previous accumulated seconds + current session
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

// ─── Inline Status Dropdown ───────────────────────────────────────────────────
// Clickable status pill.  When a task is Completed the pill is locked and
// no dropdown opens.  While the timer is running for the current user the
// accumulated + current-session time is shown below the pill.
// The dropdown is rendered with `position: fixed` so it is never clipped
// by overflow:hidden ancestors (e.g. expanded TaskCard panels).
function StatusDropdown({
    task,
    projectId,
    currentUserId,
    canManage = false,
    hasSubtasks = false, // if true, status is auto-managed from subtask statuses
    size = 'sm',
}: {
    task: Task;
    projectId: string;
    currentUserId: string;
    canManage?: boolean;
    hasSubtasks?: boolean;
    size?: 'sm' | 'xs';
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const [updateTask, { isLoading }] = useUpdateTaskMutation();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Completed tasks or tasks whose status is auto-managed from subtasks cannot be
    // manually changed.
    const isLocked = task.status === 'completed';
    const isAutoManaged = hasSubtasks; // parent task status driven by subtask states

    // ── Assignee gate
    const isAssignee = task.assignees.some((a) => {
        const uid = typeof a === 'object' ? ((a as any)._id || (a as any).id) : a;
        return uid === currentUserId;
    });
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

    const sStyle = statusStyles[task.status] || statusStyles.todo;

    // Current user's active timer (if any)
    const activeTimer = task.activeTimers?.find((t) => {
        const uid = typeof t.userId === 'object'
            ? (t.userId as any)._id || (t.userId as any).id
            : t.userId;
        return uid === currentUserId;
    });

    // Previously accumulated seconds for the current user
    const accEntry = task.accumulatedSeconds?.find((a) => {
        const uid = typeof a.userId === 'object'
            ? (a.userId as any)._id || (a.userId as any).id
            : a.userId;
        return uid === currentUserId;
    });
    const baseSeconds = accEntry?.seconds ?? 0;

    // ── Status transition rules ──────────────────────────────────────────────
    // todo        → in-progress only (first start)
    // in-progress → paused | completed (can't go back to todo)
    // paused      → in-progress | completed
    // completed   → locked (no transitions)
    const allowedNext: Record<string, Task['status'][]> = {
        'todo':        ['in-progress'],
        'in-progress': ['paused', 'completed'],
        'paused':      ['in-progress', 'completed'],
        'completed':   [],
    };
    const validNext = allowedNext[task.status] ?? [];

    const allOptions: { value: Task['status']; label: string }[] = [
        { value: 'todo', label: 'To Do' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'paused', label: 'Paused' },
        { value: 'completed', label: 'Completed' },
    ];
    // Show current status (checked) + allowed next statuses only
    const options = allOptions.filter(o => o.value === task.status || validNext.includes(o.value));

    const handleOpen = () => {
        if (isLoading || isLocked || isAutoManaged || !canInteract) return;
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 4, left: rect.left });
        }
        setIsOpen(v => !v);
    };

    const handleSelect = async (newStatus: Task['status']) => {
        setIsOpen(false);
        if (newStatus === task.status || isLocked || isAutoManaged || !canInteract) return;
        if (!validNext.includes(newStatus)) return;
        try {
            await updateTask({ projectId, taskId: task._id, data: { status: newStatus } }).unwrap();
        } catch (err: any) {
            const message = err?.data?.message || err?.message || 'Failed to update status';
            alert(message);
        }
    };

    // ── Read-only pill: non-assignees or auto-managed tasks ────────────────
    if (!canInteract || isAutoManaged) {
        const lockTitle = isAutoManaged
            ? 'Status auto-managed from subtasks'
            : 'Only assigned team members can change this task\'s status';
        return (
            <div
                className="inline-flex flex-col gap-0.5"
                onClick={(e) => e.stopPropagation()}
                title={isLocked ? 'Task completed — status is locked' : lockTitle}
            >
                <span
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border cursor-default ${
                        size === 'xs' ? 'text-[10px]' : 'text-[11px]'
                    } font-medium capitalize`}
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: sStyle.bg, color: sStyle.text }}
                >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sStyle.dot }} />
                    {task.status.replace('-', ' ')}
                    {isAutoManaged
                        ? <span className="text-[9px] ml-0.5 opacity-60">auto</span>
                        : (isLocked && <Lock size={8} style={{ color: 'var(--color-text-muted)' }} />)}
                </span>
            </div>
        );
    }

    return (
        <div
            className="relative inline-flex flex-col gap-0.5"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Status pill trigger */}
            <button
                ref={triggerRef}
                onClick={handleOpen}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-colors ${
                    isLocked
                        ? 'cursor-not-allowed opacity-80'
                        : 'hover:brightness-95 cursor-pointer'
                } disabled:opacity-60`}
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: sStyle.bg }}
                title={isLocked ? 'Task completed — status is locked' : 'Click to change status'}
            >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sStyle.dot }} />
                <span
                    className={`font-medium capitalize ${size === 'xs' ? 'text-[10px]' : 'text-[11px]'}`}
                    style={{ color: sStyle.text }}
                >
                    {task.status.replace('-', ' ')}
                </span>
                {isLocked
                    ? <Lock size={8} style={{ color: 'var(--color-text-muted)' }} />
                    : <ChevronDown size={9} style={{ color: 'var(--color-text-muted)' }} />}
            </button>

            {/* Live timer — shown only while this user has an active session */}
            {activeTimer && (
                <div className="flex items-center gap-1 pl-1">
                    <Clock size={9} style={{ color: 'var(--color-success, #10B981)' }} className="animate-pulse flex-shrink-0" />
                    <LiveTimer startedAt={activeTimer.startedAt} baseSeconds={baseSeconds} />
                </div>
            )}

            {/* Dropdown — fixed position so it's never clipped by overflow:hidden parents */}
            {isOpen && !isLocked && (
                <div
                    ref={dropdownRef}
                    className="z-[9999] min-w-[150px] rounded-lg border shadow-xl overflow-hidden"
                    style={{
                        position: 'fixed',
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    {options.map((opt) => {
                        const oStyle = statusStyles[opt.value];
                        const isCurrent = opt.value === task.status;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => handleSelect(opt.value)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-black/5"
                                style={{
                                    backgroundColor: isCurrent ? 'var(--color-primary-soft)' : 'transparent',
                                    color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-primary)',
                                }}
                            >
                                <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: oStyle.dot }}
                                />
                                {opt.label}
                                {isCurrent && (
                                    <span className="ml-auto text-[10px]" style={{ color: 'var(--color-primary)' }}>
                                        ✓
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
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

    // Split into main tasks and subtasks so they render differently
    const mainCards = tasks.filter(t => !t.parentTaskId);
    const subtaskCards = tasks.filter(t => t.parentTaskId);

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
                {/* ── Main task cards ── */}
                {mainCards.map((task) => (
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
                                        const name = typeof assignee === 'object' && 'name' in assignee
                                            ? (assignee as any).name
                                            : typeof assignee === 'object' && 'userId' in assignee
                                                ? (typeof (assignee as any).userId === 'object' ? (assignee as any).userId.name : 'User')
                                                : 'User';
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

                {/* ── Subtask cards (smaller, visually distinct) ── */}
                {subtaskCards.length > 0 && (
                    <div className="space-y-1.5">
                        {subtaskCards.length > 0 && (
                            <p className="text-[10px] font-medium px-1 mt-2" style={{ color: 'var(--color-text-muted)' }}>
                                Subtasks ({subtaskCards.length})
                            </p>
                        )}
                        {subtaskCards.map((sub) => (
                            <div
                                key={sub._id}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('taskId', sub._id)}
                                className="px-2.5 py-2 rounded-md border group hover:shadow-sm transition-all cursor-pointer"
                                style={{
                                    backgroundColor: 'var(--color-bg-surface)',
                                    borderColor: 'var(--color-border-default)',
                                    borderLeft: `3px solid ${statusStyles[sub.status]?.dot || '#9CA3AF'}`,
                                }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Pencil size={10} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                                            {sub.title}
                                        </span>
                                    </div>
                                    <span
                                        className="text-[9px] font-medium px-1.5 py-0.5 rounded capitalize flex-shrink-0"
                                        style={{ backgroundColor: priorityStyles[sub.priority]?.bg || '#f3f4f6', color: priorityStyles[sub.priority]?.text || '#4b5563' }}
                                    >
                                        {sub.priority}
                                    </span>
                                </div>
                                {sub.assignees.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1.5">
                                        {sub.assignees.slice(0, 3).map((a: any, i: number) => {
                                            const name = a?.name || 'U';
                                            return (
                                                <div key={i} className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-700" title={name}>
                                                    {name.charAt(0)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

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

