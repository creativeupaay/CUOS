import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Plus, LayoutList, Kanban, Filter } from 'lucide-react';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { useUpdateTaskMutation } from '@/features/project';
import type { Task } from '@/features/project';
import { TaskFormModal } from '@/components/organisms/project/TaskFormModal';
import { TaskListView } from '@/components/organisms/project/TaskListView';
import { TaskBoardView } from '@/components/organisms/project/TaskBoardView';
import { SubtaskEditPanel } from '@/components/organisms/project/SubtaskEditPanel';
import { getEntityId } from '@/lib/utils/entity';
import { logger } from '@/utils/logger';

// (Constants are now exported directly from data/project/taskConstants)

export default function ProjectTasksTab() {
    const { id: projectId } = useParams<{ id: string }>();

    const {
        tasks, mainTasks, filteredBoardTasks, projectMembers,
        currentUserId,
        viewMode, setViewMode,
        taskFilter, setTaskFilter,
        statusFilter, setStatusFilter,
        showForm, setShowForm,
        editingTask, setEditingTask,
        selectedAssignees, setSelectedAssignees, toggleAssignee,
        estDays, setEstDays, estHrs, setEstHrs, estMins, setEstMins, resetEstTime,
        isLoading, isCreating,
        handleSubmit, handleDelete, handleStatusDrop,
    } = useProjectTasks(projectId!);

    // ── Subtask edit state ────────────────────────────────────────────────────
    const [editingSubtask, setEditingSubtask] = useState<Task | null>(null);
    const [subEditAssignees, setSubEditAssignees] = useState<string[]>([]);
    const [updateTask, { isLoading: isUpdatingSubtask }] = useUpdateTaskMutation();

    const openSubtaskEdit = (sub: Task) => {
        setEditingSubtask(sub);
        setSubEditAssignees(sub.assignees.map((a) => getEntityId(a)).filter(Boolean));
    };
    const closeSubtaskEdit = () => { setEditingSubtask(null); setSubEditAssignees([]); };

    const handleSubtaskUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingSubtask) return;
        const fd = new FormData(e.currentTarget);
        try {
            await updateTask({
                projectId: projectId!,
                taskId: editingSubtask._id,
                data: {
                    title: fd.get('title') as string,
                    description: (fd.get('description') as string) || '',
                    status: (fd.get('status') as Task['status']) || editingSubtask.status,
                    priority: (fd.get('priority') as Task['priority']) || editingSubtask.priority,
                    deadline: (fd.get('deadline') as string) || undefined,
                    assignees: subEditAssignees,
                },
            }).unwrap();
            closeSubtaskEdit();
        } catch (err) {
            logger.error('Failed to update subtask:', err);
        }
    };

    // ── Task form open helpers ────────────────────────────────────────────────
    const openCreateForm = () => { setEditingTask(null); setSelectedAssignees([]); resetEstTime(null); setShowForm(true); };
    const openEditForm = (t: Task) => { setEditingTask(t); setSelectedAssignees(t.assignees.map((a) => getEntityId(a)).filter(Boolean)); resetEstTime(t); setShowForm(true); };
    const closeForm = () => { setShowForm(false); setEditingTask(null); setSelectedAssignees([]); resetEstTime(null); };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={16} className="animate-spin" /> Loading tasks...
                </div>
            </div>
        );
    }

    const myCount = tasks.filter(t => !t.parentTaskId && t.assignees.some(a => getEntityId(a) === currentUserId)).length;
    const allCount = tasks.filter(t => !t.parentTaskId).length;

    return (
        <div className="space-y-5">
            {/* ── Toolbar ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    {(['my', 'all'] as const).map(f => (
                        <button key={f} onClick={() => setTaskFilter(f)}
                            className="px-4 py-2.5 text-sm font-medium transition-colors border-b-2"
                            style={{ color: taskFilter === f ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderColor: taskFilter === f ? 'var(--color-primary)' : 'transparent', backgroundColor: taskFilter === f ? 'var(--color-primary-soft)' : 'transparent', borderTopLeftRadius: 6, borderTopRightRadius: 6 }}
                        >
                            {f === 'my' ? 'My Tasks' : 'All Tasks'}
                            <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: taskFilter === f ? 'var(--color-primary)' : 'var(--color-bg-subtle)', color: taskFilter === f ? 'white' : 'var(--color-text-muted)' }}>
                                {f === 'my' ? myCount : allCount}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    {/* Status filter */}
                    <div className="relative flex items-center">
                        <Filter size={12} className="absolute left-2.5 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                            className="pl-7 pr-3 text-xs font-medium rounded-lg border outline-none appearance-none cursor-pointer"
                            style={{ height: '32px', borderColor: statusFilter !== 'all' ? 'var(--color-primary)' : 'var(--color-border-default)', backgroundColor: statusFilter !== 'all' ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)', color: statusFilter !== 'all' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                        >
                            <option value="all">All Status</option>
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="paused">Paused</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>

                    {/* View toggle */}
                    <div className="flex items-center p-0.5 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                        {([['list', 'List', LayoutList], ['board', 'Board', Kanban]] as const).map(([mode, label, Icon]) => (
                            <button key={mode} onClick={() => setViewMode(mode as typeof viewMode)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === mode ? 'shadow-sm' : ''}`}
                                style={{ backgroundColor: viewMode === mode ? 'var(--color-bg-surface)' : 'transparent', color: viewMode === mode ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                            >
                                <Icon size={14} /> {label}
                            </button>
                        ))}
                    </div>

                    <button onClick={openCreateForm}
                        className="flex items-center gap-1.5 px-3.5 text-sm font-medium text-white rounded-lg transition-colors"
                        style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                    >
                        <Plus size={15} /> New Task
                    </button>
                </div>
            </div>

            {/* ── Task Form Modal ───────────────────────────────────────────── */}
            {showForm && (
                <TaskFormModal
                    editingTask={editingTask}
                    isCreating={isCreating}
                    selectedAssignees={selectedAssignees}
                    projectMembers={projectMembers}
                    estDays={estDays} estHrs={estHrs} estMins={estMins}
                    setEstDays={setEstDays} setEstHrs={setEstHrs} setEstMins={setEstMins}
                    toggleAssignee={toggleAssignee}
                    onClose={closeForm}
                    onSubmit={handleSubmit}
                />
            )}

            {/* ── Subtask Edit Panel ────────────────────────────────────────── */}
            {editingSubtask && (
                <SubtaskEditPanel
                    subtask={editingSubtask}
                    parentTask={editingSubtask}
                    isUpdating={isUpdatingSubtask}
                    onClose={closeSubtaskEdit}
                    onSubmit={handleSubtaskUpdate}
                    editAssignees={subEditAssignees}
                    toggleEditAssignee={(uid) => setSubEditAssignees(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])}
                />
            )}

            {/* ── Views ─────────────────────────────────────────────────────── */}
            {viewMode === 'list' ? (
                <TaskListView
                    tasks={mainTasks}
                    projectId={projectId!}
                    onEdit={openEditForm}
                    onDelete={handleDelete}
                    onSubtaskEdit={openSubtaskEdit}
                />
            ) : (
                <TaskBoardView
                    tasks={filteredBoardTasks}
                    onEdit={openEditForm}
                    onNew={openCreateForm}
                    onDrop={(taskId, newStatus) => handleStatusDrop(taskId, newStatus)}
                />
            )}
        </div>
    );
}
