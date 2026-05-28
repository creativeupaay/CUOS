import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
    ChevronDown,
    ChevronRight,
    Trash2,
    MoreVertical,
    FileText,
    Plus,
    Lock,
} from 'lucide-react';
import type { RootState } from '@/app/store';
import {
    useGetProjectByIdQuery,
    useGetSubtasksQuery,
    useCreateSubtaskMutation,
} from '@/features/project';
import type { Task, ProjectAssignee } from '@/features/project';
import { Avatar } from '@/components/atoms/Avatar';
import { StatusDropdown } from '../StatusDropdown';
import { SubtaskForm } from '../SubtaskForm';
import { SubtaskRow } from '../SubtaskRow';
import { PRIORITY_STYLES } from '@/data/project/taskConstants';
import { getEntityId } from '@/lib/utils/entity';
import { hasAdminRole } from '@/lib/utils/roles';
import { logger } from '@/utils/logger';

export interface TaskCardProps {
    task: Task;
    projectId: string;
    onEdit: (t: Task) => void;
    onDelete: (id: string) => void;
    onSubtaskEdit: (sub: Task) => void;
}

export function TaskCard({ task, projectId, onEdit, onDelete, onSubtaskEdit }: TaskCardProps) {
    const currentUser = useSelector((s: RootState) => s.auth.user);
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? ((currentUser.role as unknown as Record<string, unknown>).name as string | undefined)?.toLowerCase() ?? ''
            : String(currentUser.role).toLowerCase()
        : '';
    const isSuperAdmin = hasAdminRole(roleName);
    const currentUserId = getEntityId((currentUser as unknown as Record<string, unknown>)?._id ?? (currentUser as unknown as Record<string, unknown>)?.id);

    const { data: projectData } = useGetProjectByIdQuery(projectId, { refetchOnMountOrArgChange: 30 });
    const project = projectData?.data;

    const [isExpanded, setIsExpanded] = useState(false);
    const [showSubtaskForm, setShowSubtaskForm] = useState(false);
    const [subSelectedAssignees, setSubSelectedAssignees] = useState<string[]>([]);
    const [createSubtask, { isLoading: isCreatingSubtask }] = useCreateSubtaskMutation();

    const { data: subtasksData, refetch: refetchSubtasks } = useGetSubtasksQuery(
        { projectId, taskId: task._id },
        { skip: !isExpanded }
    );
    const allSubtasks: Task[] = (subtasksData?.data as Task[]) ?? [];
    const displaySubtaskCount = allSubtasks.length > 0 ? allSubtasks.length : (task.subtaskCount ?? 0);

    const isProjectManager = isSuperAdmin || (() => {
        if (!project || !currentUserId) return false;
        const a = project.assignees.find((a: ProjectAssignee) => {
            const empId = typeof a.employeeId === 'object' && a.employeeId !== null ? a.employeeId as Record<string, unknown> : null;
            const uid = empId ? getEntityId(empId.userId) : getEntityId(a.userId);
            return uid === currentUserId;
        });
        return a?.role === 'manager';
    })();

    const isProjectMember = isSuperAdmin || (() => {
        if (!project || !currentUserId) return false;
        return project.assignees.some((a: ProjectAssignee) => {
            const empId = typeof a.employeeId === 'object' && a.employeeId !== null ? a.employeeId as Record<string, unknown> : null;
            const uid = empId ? getEntityId(empId.userId) : getEntityId(a.userId);
            return uid === currentUserId;
        });
    })();

    const pStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;

    const handleSubtaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        try {
            await createSubtask({
                projectId,
                taskId: task._id,
                data: {
                    title: fd.get('title') as string,
                    status: (fd.get('status') as Task['status']) || 'todo',
                    priority: (fd.get('priority') as Task['priority']) || 'medium',
                    deadline: (fd.get('deadline') as string) || undefined,
                    assignees: subSelectedAssignees,
                },
            }).unwrap();
            setShowSubtaskForm(false);
            setSubSelectedAssignees([]);
            refetchSubtasks();
        } catch (err) {
            logger.error('Failed to create subtask:', err);
        }
    };

    return (
        <div
            className={`transition-all group cursor-pointer ${isExpanded ? 'rounded-[1rem] shadow-premium mb-4 overflow-hidden border-0' : 'border-b hover:bg-black/5'}`}
            style={{ borderColor: isExpanded ? 'transparent' : 'var(--color-border-default)', backgroundColor: isExpanded ? 'var(--color-bg-surface)' : 'transparent' }}
            onClick={() => setIsExpanded(v => !v)}
        >
            <div className={`grid grid-cols-12 gap-4 px-4 py-3 items-center ${isExpanded ? 'bg-[var(--color-primary-soft)]/20 border-b border-[var(--color-border-default)]' : ''}`}>
                <div className="col-span-5 flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-text-muted)' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <FileText size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <h3 className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{task.title}</h3>
                    {displaySubtaskCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                            {displaySubtaskCount} sub
                        </span>
                    )}
                </div>
                <div className="col-span-2">
                    <StatusDropdown task={task} projectId={projectId} currentUserId={currentUserId} canManage={isProjectManager} hasSubtasks={displaySubtaskCount > 0} />
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-1.5 overflow-hidden max-h-12 py-1">
                    {task.assignees.length > 0 ? (
                        task.assignees.map((assignee, index) => {
                            const name = typeof assignee === 'object' && (assignee as unknown as Record<string, unknown>).name ? (assignee as unknown as Record<string, unknown>).name as string : 'User';
                            const photoUrl = (assignee as unknown as Record<string, unknown>).profilePhoto as string || null;
                            return (
                                <div key={index} className="flex items-center gap-1 pr-1.5 bg-black/5 rounded-full shrink-0">
                                    <Avatar name={name} photoUrl={photoUrl} size={20} />
                                    <span className="text-[10px] font-medium truncate max-w-[60px]" style={{ color: 'var(--color-text-secondary)' }}>{name}</span>
                                </div>
                            );
                        })
                    ) : <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>}
                </div>
                <div className="col-span-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                </div>
                <div className="col-span-1">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: pStyle.bg, color: pStyle.text }}>{task.priority}</span>
                </div>
                <div className="col-span-1 flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isProjectManager && (
                        task.status === 'completed' ? (
                            <span title="Completed tasks cannot be deleted" className="p-1 rounded opacity-40 cursor-not-allowed" style={{ color: 'var(--color-text-muted)' }}><Lock size={13} /></span>
                        ) : (
                            <button onClick={(e) => { e.stopPropagation(); onDelete(task._id); }} className="transition-colors hover:bg-black/5 p-1 rounded" style={{ color: 'var(--color-danger)' }} title="Delete task"><Trash2 size={13} /></button>
                        )
                    )}
                    {isProjectMember && (
                        <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="transition-colors hover:bg-black/5 p-1 rounded" style={{ color: 'var(--color-text-secondary)' }} title="Edit task"><MoreVertical size={13} /></button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="pb-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-2.5">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                            Subtasks <span className="font-normal">({allSubtasks.length})</span>
                        </p>
                        {!showSubtaskForm && (
                            <button onClick={() => setShowSubtaskForm(true)} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors" style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)' }}>
                                <Plus size={11} /> Add Subtask
                            </button>
                        )}
                    </div>
                    {showSubtaskForm && (
                        <SubtaskForm
                            parentTask={task}
                            subSelectedAssignees={subSelectedAssignees}
                            isCreatingSubtask={isCreatingSubtask}
                            onClose={() => { setShowSubtaskForm(false); setSubSelectedAssignees([]); }}
                            onSubmit={handleSubtaskSubmit}
                            toggleSubAssignee={(uid) => setSubSelectedAssignees(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])}
                        />
                    )}
                    {allSubtasks.length > 0 && (
                        <div className="space-y-1.5 px-3 pb-3 mt-1">
                            {allSubtasks.map((sub: Task) => (
                                <SubtaskRow
                                    key={sub._id}
                                    subtask={sub}
                                    projectId={projectId}
                                    currentUserId={currentUserId}
                                    isProjectManager={isProjectManager}
                                    onEdit={onSubtaskEdit}
                                />
                            ))}
                        </div>
                    )}
                    {allSubtasks.length === 0 && !showSubtaskForm && (
                        <p className="text-xs pb-3 text-center px-4 mt-2" style={{ color: 'var(--color-text-muted)' }}>No subtasks yet. Click "Add Subtask" to create one.</p>
                    )}
                </div>
            )}
        </div>
    );
}
