import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetTasksQuery,
    useCreateTaskMutation,
    useUpdateTaskMutation,
    useDeleteTaskMutation,
    useGetProjectByIdQuery,
    useCreateSubtaskMutation,
} from '@/features/project';
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '@/features/project';
import { logger } from '@/utils/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getEntityId(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
        const v = value as Record<string, unknown>;
        if (v._id) return getEntityId(v._id);
        if (v.id) return getEntityId(v.id);
        if (v.userId) return getEntityId(v.userId);
    }
    return String(value);
}

export function hasAdminRole(role: unknown): boolean {
    const normalized =
        typeof role === 'string'
            ? role.toLowerCase()
            : role && typeof role === 'object'
            ? String((role as Record<string, unknown>).name ?? '').toLowerCase()
            : '';
    return ['super-admin', 'super_admin', 'admin'].includes(normalized);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatusFilter = 'all' | 'todo' | 'in-progress' | 'paused' | 'completed';
export type TaskOwnerFilter = 'all' | 'my';
export type ViewMode = 'list' | 'board';

export interface UseProjectTasksReturn {
    // Data
    tasks: Task[];
    mainTasks: Task[];
    filteredBoardTasks: Task[];
    projectMembers: unknown[];
    // Auth
    currentUserId: string;
    isSuperAdmin: boolean;
    // View state
    viewMode: ViewMode;
    setViewMode: (m: ViewMode) => void;
    taskFilter: TaskOwnerFilter;
    setTaskFilter: (f: TaskOwnerFilter) => void;
    statusFilter: TaskStatusFilter;
    setStatusFilter: (f: TaskStatusFilter) => void;
    // Task form state
    showForm: boolean;
    setShowForm: (v: boolean) => void;
    editingTask: Task | null;
    setEditingTask: (t: Task | null) => void;
    selectedAssignees: string[];
    setSelectedAssignees: (ids: string[]) => void;
    toggleAssignee: (uid: string) => void;
    // Estimated time
    estDays: number;
    setEstDays: (n: number) => void;
    estHrs: number;
    setEstHrs: (n: number) => void;
    estMins: number;
    setEstMins: (n: number) => void;
    resetEstTime: (task?: Task | null) => void;
    // Loading
    isLoading: boolean;
    isCreating: boolean;
    // CRUD
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    handleDelete: (taskId: string) => Promise<void>;
    handleStatusDrop: (taskId: string, newStatus: string) => void;
    // Subtask CRUD
    handleCreateSubtask: (parentTaskId: string, subtaskData: Partial<Task>) => Promise<void>;
    handleUpdateSubtask: (subtaskId: string, subtaskData: Partial<Task>) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProjectTasks(projectId: string): UseProjectTasksReturn {
    const currentUser = useSelector((s: RootState) => s.auth.user);
    const currentUserId = getEntityId(
        (currentUser as unknown as Record<string, unknown>)?._id ??
        (currentUser as unknown as Record<string, unknown>)?.id
    );

    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? ((currentUser.role as unknown as Record<string, unknown>).name as string | undefined)?.toLowerCase() ?? ''
            : String(currentUser.role).toLowerCase()
        : '';
    const isSuperAdmin = hasAdminRole(roleName);

    // ── View / filter state ──────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [taskFilter, setTaskFilter] = useState<TaskOwnerFilter>(isSuperAdmin ? 'all' : 'my');
    const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');

    // ── Task form state ──────────────────────────────────────────────────────
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

    // ── Estimated time ────────────────────────────────────────────────────────
    const [estDays, setEstDays] = useState(0);
    const [estHrs, setEstHrs] = useState(0);
    const [estMins, setEstMins] = useState(0);

    const resetEstTime = (task?: Task | null) => {
        const totalMins = Math.round((task?.estimatedHours ?? 0) * 60);
        setEstDays(Math.floor(totalMins / (24 * 60)));
        setEstHrs(Math.floor((totalMins % (24 * 60)) / 60));
        setEstMins(totalMins % 60);
    };

    // ── RTK Query ─────────────────────────────────────────────────────────────
    const { data: projectData } = useGetProjectByIdQuery(projectId, {
        refetchOnMountOrArgChange: 30,
    });
    const projectMembers: unknown[] = (projectData?.data?.assignees as unknown[]) ?? [];

    const { data, isLoading } = useGetTasksQuery({ projectId });
    const tasks: Task[] = useMemo(() => (data?.data as Task[]) ?? [], [data?.data]);

    // Board view fetches subtasks too
    const { data: boardAllData } = useGetTasksQuery(
        { projectId, includeSubtasks: true },
        { skip: viewMode !== 'board' }
    );
    const allBoardTasks: Task[] = useMemo(() => (boardAllData?.data as Task[]) ?? [], [boardAllData?.data]);

    // ── Derived lists ─────────────────────────────────────────────────────────
    const toggleAssignee = (userId: string) => {
        setSelectedAssignees((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const filteredBoardTasks = useMemo(() => {
        if (taskFilter === 'all') return allBoardTasks;
        return allBoardTasks.filter((t) =>
            t.assignees.some((a) => getEntityId(a) === currentUserId)
        );
    }, [allBoardTasks, taskFilter, currentUserId]);

    const filteredTasks = useMemo(() => {
        if (taskFilter === 'all') return tasks;
        return tasks.filter((t) =>
            (t.assignees ?? []).some((a) => getEntityId(a) === currentUserId)
        );
    }, [tasks, taskFilter, currentUserId]);

    const mainTasks = useMemo(() => {
        const all = filteredTasks.filter((t) => !t.parentTaskId);
        return statusFilter === 'all' ? all : all.filter((t) => t.status === statusFilter);
    }, [filteredTasks, statusFilter]);

    // ── Mutations ─────────────────────────────────────────────────────────────
    const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();
    const [updateTask] = useUpdateTaskMutation();
    const [deleteTask] = useDeleteTaskMutation();
    const [createSubtask] = useCreateSubtaskMutation();

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const estimatedHoursVal =
            estDays * 24 + estHrs + estMins / 60 > 0
                ? estDays * 24 + estHrs + estMins / 60
                : undefined;

        const taskData = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            status: formData.get('status') as Task['status'],
            priority: formData.get('priority') as Task['priority'],
            deadline: (formData.get('deadline') as string) || undefined,
            startDate: (formData.get('startDate') as string) || undefined,
            estimatedHours: estimatedHoursVal,
            assignees: selectedAssignees,
        };

        if (editingTask) {
            updateTask({
                projectId,
                taskId: editingTask._id,
                data: taskData,
            });
            // Toast would ideally be added here but RTK Query manages errors internally too
        } else {
            createTask({ projectId, data: taskData });
        }
        
        setShowForm(false);
        setEditingTask(null);
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm('Delete this task?')) return;
        try {
            await deleteTask({ projectId, taskId }).unwrap();
        } catch (error) {
            logger.error('Failed to delete task:', error);
        }
    };

    const handleStatusDrop = (taskId: string, newStatus: string) => {
        const droppedTask = filteredBoardTasks.find((t) => t._id === taskId);
        if (!droppedTask) return;
        const isAssignee = droppedTask.assignees.some(
            (a) => getEntityId(a) === currentUserId
        );
        if (!isSuperAdmin && !isAssignee) return;
        updateTask({ projectId, taskId, data: { status: newStatus as Task['status'] } });
    };

    const handleCreateSubtask = async (parentTaskId: string, subtaskData: Partial<Task>) => {
        try {
            await createSubtask({
                projectId,
                taskId: parentTaskId,
                data: subtaskData as unknown as CreateTaskRequest,
            }).unwrap();
        } catch (err) {
            logger.error('Failed to create subtask:', err);
        }
    };

    const handleUpdateSubtask = async (subtaskId: string, subtaskData: Partial<Task>) => {
        try {
            await updateTask({
                projectId,
                taskId: subtaskId,
                data: subtaskData as unknown as UpdateTaskRequest,
            }).unwrap();
        } catch (err) {
            logger.error('Failed to update subtask:', err);
        }
    };

    return {
        tasks,
        mainTasks,
        filteredBoardTasks,
        projectMembers,
        currentUserId,
        isSuperAdmin,
        viewMode,
        setViewMode,
        taskFilter,
        setTaskFilter,
        statusFilter,
        setStatusFilter,
        showForm,
        setShowForm,
        editingTask,
        setEditingTask,
        selectedAssignees,
        setSelectedAssignees,
        toggleAssignee,
        estDays,
        setEstDays,
        estHrs,
        setEstHrs,
        estMins,
        setEstMins,
        resetEstTime,
        isLoading,
        isCreating,
        handleSubmit,
        handleDelete,
        handleStatusDrop,
        handleCreateSubtask,
        handleUpdateSubtask,
    };
}
