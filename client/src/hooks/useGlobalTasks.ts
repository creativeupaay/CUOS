import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetProjectsQuery,
    useGetTasksQuery,
    useCreateTaskMutation,
    useUpdateTaskMutation,
    useUpdateIndividualTaskMutation,
    useDeleteTaskMutation,
    useDeleteIndividualTaskMutation,
    useCreateTimeLogMutation,
    useCreateIndividualTaskTimeLogMutation,
    useGetIndividualTasksQuery,
    useCreateIndividualTaskMutation,
} from '@/features/project';
import type { Task, Project } from '@/features/project';
import { logger } from '@/utils/logger';
import { hasModuleAdminAccess } from '@/utils/modulePermissions';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEntityId(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        return String(obj._id ?? obj.id ?? '');
    }
    return String(value);
}

function isAdminRole(user: any): boolean {
    if (!user) return false;
    const roleName = typeof user.role === 'object' ? (user.role as any).name : user.role;
    const isPartner = String(roleName || '').toLowerCase() === 'partner';
    return hasModuleAdminAccess(user, 'projectManagement') || isPartner;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlobalTask extends Task {
    _projectId: string;       // resolved project id string
    _projectName: string;     // resolved project name
}

export type GlobalTaskStatusFilter = 'all' | 'todo' | 'in-progress' | 'paused' | 'completed';
export type GlobalTaskPriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';
export type GlobalTaskOwnerFilter = 'my' | 'all';

export interface GlobalTaskFilters {
    owner: GlobalTaskOwnerFilter;
    status: GlobalTaskStatusFilter;
    priority: GlobalTaskPriorityFilter;
    projectId: string;   // '' = all
    dateFrom: string;    // ISO date string, '' = no filter
    dateTo: string;      // ISO date string, '' = no filter
    userId: string;      // '' = all
    search: string;
    isOverdue?: boolean;
}

// ─── Per-project task fetcher sub-hook ────────────────────────────────────────

const MAX_PROJECTS = 30;

function useTasksForProjects(projectIds: string[]): {
    tasksByProject: Record<string, Task[]>;
    isLoading: boolean;
} {
    const ids = useMemo(() => {
        const padded = [...projectIds];
        while (padded.length < MAX_PROJECTS) padded.push('');
        return padded.slice(0, MAX_PROJECTS);
    }, [projectIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    /* eslint-disable react-hooks/rules-of-hooks */
    const r0  = useGetTasksQuery({ projectId: ids[0]  }, { skip: !ids[0]  });
    const r1  = useGetTasksQuery({ projectId: ids[1]  }, { skip: !ids[1]  });
    const r2  = useGetTasksQuery({ projectId: ids[2]  }, { skip: !ids[2]  });
    const r3  = useGetTasksQuery({ projectId: ids[3]  }, { skip: !ids[3]  });
    const r4  = useGetTasksQuery({ projectId: ids[4]  }, { skip: !ids[4]  });
    const r5  = useGetTasksQuery({ projectId: ids[5]  }, { skip: !ids[5]  });
    const r6  = useGetTasksQuery({ projectId: ids[6]  }, { skip: !ids[6]  });
    const r7  = useGetTasksQuery({ projectId: ids[7]  }, { skip: !ids[7]  });
    const r8  = useGetTasksQuery({ projectId: ids[8]  }, { skip: !ids[8]  });
    const r9  = useGetTasksQuery({ projectId: ids[9]  }, { skip: !ids[9]  });
    const r10 = useGetTasksQuery({ projectId: ids[10] }, { skip: !ids[10] });
    const r11 = useGetTasksQuery({ projectId: ids[11] }, { skip: !ids[11] });
    const r12 = useGetTasksQuery({ projectId: ids[12] }, { skip: !ids[12] });
    const r13 = useGetTasksQuery({ projectId: ids[13] }, { skip: !ids[13] });
    const r14 = useGetTasksQuery({ projectId: ids[14] }, { skip: !ids[14] });
    const r15 = useGetTasksQuery({ projectId: ids[15] }, { skip: !ids[15] });
    const r16 = useGetTasksQuery({ projectId: ids[16] }, { skip: !ids[16] });
    const r17 = useGetTasksQuery({ projectId: ids[17] }, { skip: !ids[17] });
    const r18 = useGetTasksQuery({ projectId: ids[18] }, { skip: !ids[18] });
    const r19 = useGetTasksQuery({ projectId: ids[19] }, { skip: !ids[19] });
    const r20 = useGetTasksQuery({ projectId: ids[20] }, { skip: !ids[20] });
    const r21 = useGetTasksQuery({ projectId: ids[21] }, { skip: !ids[21] });
    const r22 = useGetTasksQuery({ projectId: ids[22] }, { skip: !ids[22] });
    const r23 = useGetTasksQuery({ projectId: ids[23] }, { skip: !ids[23] });
    const r24 = useGetTasksQuery({ projectId: ids[24] }, { skip: !ids[24] });
    const r25 = useGetTasksQuery({ projectId: ids[25] }, { skip: !ids[25] });
    const r26 = useGetTasksQuery({ projectId: ids[26] }, { skip: !ids[26] });
    const r27 = useGetTasksQuery({ projectId: ids[27] }, { skip: !ids[27] });
    const r28 = useGetTasksQuery({ projectId: ids[28] }, { skip: !ids[28] });
    const r29 = useGetTasksQuery({ projectId: ids[29] }, { skip: !ids[29] });
    /* eslint-enable react-hooks/rules-of-hooks */

    const results = [r0,r1,r2,r3,r4,r5,r6,r7,r8,r9,r10,r11,r12,r13,r14,r15,r16,r17,r18,r19,r20,r21,r22,r23,r24,r25,r26,r27,r28,r29];

    // Use a plain object (not Map) so reference equality works cleanly with useMemo
    const tasksByProject = useMemo(() => {
        const obj: Record<string, Task[]> = {};
        results.forEach((r, i) => {
            const pid = ids[i];
            if (!pid) return;
            obj[pid] = (r.data?.data as Task[]) ?? [];
        });
        return obj;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ids.join(','), ...results.map(r => r.data?.data)]);

    const isLoading = results.some((r, i) => !!ids[i] && r.isLoading);

    return { tasksByProject, isLoading };
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export interface UseGlobalTasksReturn {
    allTasks: GlobalTask[];
    filteredTasks: GlobalTask[];
    myTasksCount: number;
    allTasksCount: number;
    dailyTodos: GlobalTask[];
    projects: Project[];
    currentUserId: string;
    isAdmin: boolean;
    filters: GlobalTaskFilters;
    setFilters: (f: Partial<GlobalTaskFilters>) => void;
    isLoading: boolean;
    createTask: (projectId: string, data: Partial<Task>) => Promise<Task | null>;
    updateTask: (projectId: string, taskId: string, data: Partial<Task>) => Promise<void>;
    deleteTask: (projectId: string, taskId: string) => Promise<void>;
    logTime: (projectId: string, taskId: string, minutes: number, description?: string) => Promise<void>;
    isCreating: boolean;
}

export function useGlobalTasks(): UseGlobalTasksReturn {
    const currentUser = useSelector((s: RootState) => s.auth.user);
    const currentUserId = getEntityId(
        (currentUser as unknown as Record<string, unknown>)?._id ??
        (currentUser as unknown as Record<string, unknown>)?.id
    );
    const isAdmin = isAdminRole(currentUser);

    // ── Filters ──────────────────────────────────────────────────────────────
    const [filters, setFiltersState] = useState<GlobalTaskFilters>({
        owner: isAdmin ? 'all' : 'my',
        status: 'all',
        priority: 'all',
        projectId: '',
        dateFrom: '',
        dateTo: '',
        userId: '',
        search: '',
        isOverdue: false,
    });

    const setFilters = useCallback((partial: Partial<GlobalTaskFilters>) => {
        setFiltersState(prev => ({ ...prev, ...partial }));
    }, []);

    // ── Projects ─────────────────────────────────────────────────────────────
    const { data: projectsData, isLoading: projectsLoading } = useGetProjectsQuery({});
    const projects: Project[] = useMemo(() => (projectsData?.data as Project[]) ?? [], [projectsData]);
    const projectIds = useMemo(() => projects.map(p => p._id), [projects]);

    // ── Tasks per project ────────────────────────────────────────────────────
    const { tasksByProject, isLoading: tasksLoading } = useTasksForProjects(projectIds);

    // ── Individual tasks ─────────────────────────────────────────────────────
    const { data: individualTasksRes, isLoading: individualLoading } = useGetIndividualTasksQuery();
    const individualTasksFromServer = useMemo(() => (individualTasksRes?.data as Task[]) ?? [], [individualTasksRes]);

    // ── Local overlay state for instant UI updates ───────────────────────────
    // These override server state so mutations feel instant
    const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<Task>>>({});
    const [localNewIndividualTasks, setLocalNewIndividualTasks] = useState<GlobalTask[]>([]);
    const [localNewProjectTasks, setLocalNewProjectTasks] = useState<GlobalTask[]>([]);
    const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());

    // Sync: once server data arrives with a task we added locally, remove from local list
    const serverTaskIdsRef = useRef<Set<string>>(new Set());
    // Persistent snapshot of all task data ever seen — used so orphan pass can render
    // tasks even during the gap when projectA cache clears before projectB cache loads
    const allKnownTasksRef = useRef<Record<string, Task>>({});
    useEffect(() => {
        const serverIds = new Set<string>();
        // Map taskId -> project bucket it lives in server-side ('' = individual)
        const serverTaskProject: Record<string, string> = {};

        Object.entries(tasksByProject).forEach(([pid, tasks]) => tasks.forEach(t => {
            serverIds.add(t._id);
            serverTaskProject[t._id] = pid;
        }));
        individualTasksFromServer.forEach(t => {
            serverIds.add(t._id);
            serverTaskProject[t._id] = '';
        });
        serverTaskIdsRef.current = serverIds;

        // Keep a persistent snapshot of all task data — survives cache gaps during refetch
        Object.values(tasksByProject).forEach(tasks => tasks.forEach(t => {
            allKnownTasksRef.current[t._id] = t;
        }));
        individualTasksFromServer.forEach(t => {
            allKnownTasksRef.current[t._id] = t;
        });

        // Remove local tasks that are now in server data
        setLocalNewIndividualTasks(prev => prev.filter(t => !serverIds.has(t._id)));
        setLocalNewProjectTasks(prev => prev.filter(t => !serverIds.has(t._id)));

        // Smart override cleanup:
        // - If task no longer exists: remove override
        // - If override has projectId: only remove when server task is in the correct bucket
        // - Otherwise: remove (server now has the updated value)
        setLocalOverrides(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => {
                if (!serverIds.has(id)) {
                    delete next[id];
                    return;
                }
                const override = next[id];
                if (override.projectId !== undefined) {
                    // Only clear projectId override once server reflects the new project
                    const expectedProjectId = (override.projectId as string) || '';
                    if (serverTaskProject[id] === expectedProjectId) {
                        delete next[id];
                    }
                    // else: keep override — server hasn't caught up yet
                } else {
                    // Non-project override (status, priority, etc): server has latest, safe to clear
                    delete next[id];
                }
            });
            return next;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasksByProject, individualTasksFromServer]);

    // ── Build global task list ───────────────────────────────────────────────
    const allTasks = useMemo<GlobalTask[]>(() => {
        const result: GlobalTask[] = [];
        // Track which task IDs have been added so we don't duplicate during moves
        const addedIds = new Set<string>();

        // Add project tasks from server
        Object.entries(tasksByProject).forEach(([pid, tasks]) => {
            tasks.forEach(task => {
                if (task.parentTaskId) return;
                if (deletedTaskIds.has(task._id)) return;
                const override = localOverrides[task._id];
                const overriddenProjectId = override?.projectId !== undefined ? (override.projectId as string) : null;

                // Task was moved to a DIFFERENT project or to individual — skip from old bucket.
                // It will appear under the new bucket or be added by the individual loop.
                if (overriddenProjectId !== null && overriddenProjectId !== pid) return;

                const finalProjectId = overriddenProjectId !== null ? (overriddenProjectId || '') : pid;
                const finalProject = projects.find(p => p._id === finalProjectId);
                addedIds.add(task._id);
                result.push({
                    ...task,
                    ...(override || {}),
                    _projectId: finalProjectId,
                    _projectName: finalProject?.name ?? (finalProjectId ? 'Unknown Project' : 'Personal'),
                });
            });
        });

        // Add individual tasks from server
        individualTasksFromServer.forEach(task => {
            if (task.parentTaskId) return;
            if (deletedTaskIds.has(task._id)) return;
            const override = localOverrides[task._id];
            const overriddenProjectId = override?.projectId !== undefined ? (override.projectId as string) : null;

            // Task was moved to a project — skip from individual list.
            // It will appear in the project bucket above (or the orphan pass below).
            if (overriddenProjectId !== null && overriddenProjectId !== '') return;

            const finalProjectId = '';
            addedIds.add(task._id);
            result.push({
                ...task,
                ...(override || {}),
                _projectId: finalProjectId,
                _projectName: 'Personal',
            });
        });

        // Orphan pass: tasks that were moved to a project bucket not yet reflected in server data
        // (e.g. individual → project, or project → different project during cache refetch gap)
        // Uses allKnownTasksRef so we always have task data even when it's between buckets
        Object.entries(localOverrides).forEach(([overrideTaskId, override]) => {
            const overriddenProjectId = override?.projectId as string | undefined;
            if (!overriddenProjectId) return; // not a project-move override
            if (addedIds.has(overrideTaskId)) return; // already rendered above
            if (deletedTaskIds.has(overrideTaskId)) return;
            // Use persistent snapshot — works even when task is between buckets during refetch
            const sourceTask = allKnownTasksRef.current[overrideTaskId];
            if (!sourceTask) return; // truly unknown task
            const finalProject = projects.find(p => p._id === overriddenProjectId);
            addedIds.add(overrideTaskId);
            result.push({
                ...sourceTask,
                ...(override || {}),
                _projectId: overriddenProjectId,
                _projectName: finalProject?.name ?? 'Unknown Project',
            });
        });

        // Add locally created tasks not yet in server data
        localNewProjectTasks.forEach(task => {
            if (!deletedTaskIds.has(task._id) && !addedIds.has(task._id)) result.push(task);
        });
        localNewIndividualTasks.forEach(task => {
            if (!deletedTaskIds.has(task._id) && !addedIds.has(task._id)) result.push(task);
        });

        // Sort: incomplete first, then by deadline
        result.sort((a, b) => {
            const statusOrder: Record<string, number> = { 'todo': 0, 'in-progress': 1, 'paused': 2, 'completed': 3 };
            const ao = statusOrder[a.status] ?? 4;
            const bo = statusOrder[b.status] ?? 4;
            if (ao !== bo) return ao - bo;
            const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
            const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
            return ad - bd;
        });
        return result;
    }, [tasksByProject, individualTasksFromServer, projects, localOverrides, localNewProjectTasks, localNewIndividualTasks, deletedTaskIds]);

    const myTasksCount = useMemo(() => {
        return allTasks.filter(task => {
            const isAssigned = task.assignees.some(a => getEntityId(a) === currentUserId);
            const isCreator = getEntityId(task.createdBy) === currentUserId;
            return isAssigned || isCreator;
        }).length;
    }, [allTasks, currentUserId]);

    const allTasksCount = allTasks.length;

    const dailyTodos = useMemo<GlobalTask[]>(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return allTasks.filter(task => {
            const isAssigned = task.assignees.some(a => getEntityId(a) === currentUserId);
            const isCreator = getEntityId(task.createdBy) === currentUserId;
            
            if (!isAssigned && !isCreator) return false;

            const createdDate = new Date(task.createdAt || Date.now());
            const isCreatedToday = createdDate >= today && createdDate < tomorrow;

            let isDueToday = false;
            if (task.deadline) {
                const due = new Date(task.deadline);
                due.setHours(0, 0, 0, 0);
                isDueToday = due.getTime() === today.getTime();
            }

            const isWorkingOn = task.status === 'in-progress';

            return isCreatedToday || isDueToday || isWorkingOn;
        });
    }, [allTasks, currentUserId]);

    // ── Filtered tasks ───────────────────────────────────────────────────────
    const filteredTasks = useMemo<GlobalTask[]>(() => {
        return allTasks.filter(task => {
            if (filters.owner === 'my') {
                const isAssigned = task.assignees.some(a => getEntityId(a) === currentUserId);
                const isCreator = getEntityId(task.createdBy) === currentUserId;
                if (!isAssigned && !isCreator) return false;
            }
            if (filters.status !== 'all' && task.status !== filters.status) return false;
            if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
            if (filters.projectId === '__personal__') {
                if (task._projectId !== '') return false;
            } else if (filters.projectId && task._projectId !== filters.projectId) {
                return false;
            }
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
                const isAssigned = task.assignees.some(a => getEntityId(a) === filters.userId);
                const isCreator = getEntityId(task.createdBy) === filters.userId;
                if (!isAssigned && !isCreator) return false;
            }
            if (filters.search) {
                const q = filters.search.toLowerCase();
                const inTitle = task.title.toLowerCase().includes(q);
                const inProject = task._projectName.toLowerCase().includes(q);
                const inDesc = (task.description ?? '').toLowerCase().includes(q);
                
                const inCreator = task.createdBy && typeof task.createdBy === 'object'
                    ? ((task.createdBy as any).name?.toLowerCase().includes(q) || (task.createdBy as any).email?.toLowerCase().includes(q))
                    : false;
                    
                const inAssignees = task.assignees.some(a => {
                    if (a && typeof a === 'object') {
                        return (a as any).name?.toLowerCase().includes(q) || (a as any).email?.toLowerCase().includes(q);
                    }
                    return false;
                });
                
                const inStatus = task.status.toLowerCase().includes(q);
                const inPriority = task.priority.toLowerCase().includes(q);

                if (!inTitle && !inProject && !inDesc && !inCreator && !inAssignees && !inStatus && !inPriority) return false;
            }
            if (filters.isOverdue) {
                if (!task.deadline) return false;
                const dl = new Date(task.deadline);
                const now = new Date();
                // Match backend: deadline < exact current time
                if (dl.getTime() >= now.getTime()) return false;
                if (task.status === 'completed') return false;
            }
            return true;
        });
    }, [allTasks, filters, currentUserId]);

    // ── Mutations ─────────────────────────────────────────────────────────────
    const [createTaskMutation, { isLoading: isCreating }] = useCreateTaskMutation();
    const [createIndividualTaskMutation, { isLoading: isCreatingInd }] = useCreateIndividualTaskMutation();
    const [updateTaskMutation] = useUpdateTaskMutation();
    const [updateIndividualTaskMutation] = useUpdateIndividualTaskMutation();
    const [deleteTaskMutation] = useDeleteTaskMutation();
    const [deleteIndividualTaskMutation] = useDeleteIndividualTaskMutation();
    const [createTimeLog] = useCreateTimeLogMutation();
    const [createIndividualTimeLog] = useCreateIndividualTaskTimeLogMutation();

    const createTask = useCallback(async (projectId: string, data: Partial<Task>): Promise<Task | null> => {
        try {
            if (!projectId) {
                const result = await createIndividualTaskMutation({
                    title: data.title ?? 'Untitled Task',
                    description: data.description,
                    status: data.status,
                    priority: data.priority,
                    deadline: data.deadline,
                    estimatedHours: data.estimatedHours,
                    assignees: (data.assignees ?? []).map(a => getEntityId(a)).filter(Boolean),
                }).unwrap();
                const newTask = result.data as Task;
                // Instantly add to local list
                setLocalNewIndividualTasks(prev => [{
                    ...newTask,
                    _projectId: '',
                    _projectName: 'Personal',
                }, ...prev]);
                return newTask;
            } else {
                const result = await createTaskMutation({
                    projectId,
                    data: {
                        title: data.title ?? 'Untitled Task',
                        description: data.description,
                        status: data.status,
                        priority: data.priority,
                        deadline: data.deadline,
                        estimatedHours: data.estimatedHours,
                        assignees: (data.assignees ?? []).map(a => getEntityId(a)).filter(Boolean),
                    },
                }).unwrap();
                const newTask = result.data as Task;
                const project = projects.find(p => p._id === projectId);
                // Instantly add to local list
                setLocalNewProjectTasks(prev => [{
                    ...newTask,
                    _projectId: projectId,
                    _projectName: project?.name ?? 'Unknown Project',
                }, ...prev]);
                return newTask;
            }
        } catch (err) {
            logger.error('Failed to create task:', err);
            return null;
        }
    }, [createTaskMutation, createIndividualTaskMutation, projects]);

    const updateTask = useCallback(async (projectId: string, taskId: string, data: Partial<Task>) => {
        // Apply change instantly via local override
        const cleanData: Partial<Task> = {};
        if (data.title !== undefined) cleanData.title = data.title;
        if (data.description !== undefined) cleanData.description = data.description;
        if (data.status !== undefined) cleanData.status = data.status;
        if (data.priority !== undefined) cleanData.priority = data.priority;
        if (data.deadline !== undefined) cleanData.deadline = data.deadline;
        if (data.estimatedHours !== undefined) cleanData.estimatedHours = data.estimatedHours;
        if (data.projectId !== undefined) cleanData.projectId = data.projectId;

        // Optimistic local update — instant
        setLocalOverrides(prev => ({
            ...prev,
            [taskId]: { ...(prev[taskId] || {}), ...cleanData },
        }));

        try {
            if (!projectId) {
                await updateIndividualTaskMutation({ taskId, data: cleanData as any }).unwrap();
            } else {
                await updateTaskMutation({ projectId, taskId, data: cleanData as any }).unwrap();
            }
            // On success: DON'T clear the override immediately.
            // The useEffect sync will clear it once the server cache has caught up
            // with the new project/field value. This prevents the brief flicker where
            // the old value shows while waiting for the cache refetch to complete.
        } catch (err: any) {
            // Revert optimistic update on error
            setLocalOverrides(prev => {
                const next = { ...prev };
                delete next[taskId];
                return next;
            });
            const msg = err?.data?.message || err?.message || 'Failed to update task';
            logger.error('Failed to update task:', err);
            toast.error(msg);
        }
    }, [updateTaskMutation, updateIndividualTaskMutation]);

    const deleteTask = useCallback(async (projectId: string, taskId: string) => {
        // Instant local removal
        setDeletedTaskIds(prev => new Set([...prev, taskId]));
        try {
            if (!projectId) {
                await deleteIndividualTaskMutation({ taskId }).unwrap();
            } else {
                await deleteTaskMutation({ projectId, taskId }).unwrap();
            }
        } catch (err: any) {
            // Revert: remove from deleted set
            setDeletedTaskIds(prev => {
                const next = new Set(prev);
                next.delete(taskId);
                return next;
            });
            const msg = err?.data?.message || err?.message || 'Failed to delete task';
            logger.error('Failed to delete task:', err);
            toast.error(msg);
        }
    }, [deleteTaskMutation, deleteIndividualTaskMutation]);

    const logTime = useCallback(async (
        projectId: string,
        taskId: string,
        minutes: number,
        description?: string
    ) => {
        if (!minutes || minutes <= 0) return;
        try {
            const today = new Date().toISOString().slice(0, 10);
            if (!projectId) {
                // Individual / personal task — no projectId
                await createIndividualTimeLog({
                    taskId,
                    data: {
                        date: today,
                        duration: minutes,
                        description: description || 'Time logged via end of day',
                        billable: false,
                    },
                }).unwrap();
            } else {
                await createTimeLog({
                    projectId,
                    taskId,
                    data: {
                        date: today,
                        duration: minutes,
                        description: description || 'Time logged via task timer',
                        billable: false,
                    },
                }).unwrap();
            }
        } catch (err) {
            logger.error('Failed to log time:', err);
        }
    }, [createTimeLog, createIndividualTimeLog]);

    return {
        allTasks,
        filteredTasks,
        myTasksCount,
        allTasksCount,
        dailyTodos,
        projects,
        currentUserId,
        isAdmin,
        filters,
        setFilters,
        isLoading: projectsLoading || tasksLoading || individualLoading,
        createTask,
        updateTask,
        deleteTask,
        logTime,
        isCreating: isCreating || isCreatingInd,
    };
}
