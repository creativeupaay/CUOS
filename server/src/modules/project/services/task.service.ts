import { Task, ITask } from '../models/Task.model';
import { Employee } from '../../hrms/models/Employee.model';
import { Project } from '../models/Project.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import * as timeLogService from './timeLog.service';
import { notificationService } from '../../notification/services/notification.service';
import { addDays, isBefore, isSameDay, getDay } from 'date-fns';

/**
 * Attaches profilePhoto (url) from the Employee collection to the assignee
 * objects that Mongoose already populated from the User collection.
 * Works for both single task objects and arrays.
 */
async function attachProfilePhotos(tasks: any | any[]): Promise<any> {
    const arr = Array.isArray(tasks) ? tasks : [tasks];
    if (arr.length === 0) return tasks;

    // Collect all unique user IDs present as assignees
    const userIds = new Set<string>();
    for (const task of arr) {
        if (!task || !task.assignees) continue;
        for (const a of task.assignees) {
            const uid = typeof a === 'object' ? (a._id || a.id)?.toString() : a?.toString();
            if (uid) userIds.add(uid);
        }
    }

    if (userIds.size === 0) return tasks;

    // Single batch query — only select the fields we need
    const employees = await Employee.find(
        { userId: { $in: Array.from(userIds).map(id => new Types.ObjectId(id)) } },
        { userId: 1, 'profilePhoto.url': 1 }
    ).lean<{ userId: Types.ObjectId; profilePhoto?: { url?: string } }[]>();

    // Build userId → photo URL map
    const photoMap = new Map<string, string>();
    for (const emp of employees) {
        if (emp.profilePhoto?.url) {
            photoMap.set(emp.userId.toString(), emp.profilePhoto.url);
        }
    }

    if (photoMap.size === 0) return tasks;

    // Mutate (or clone) the assignee objects in place
    for (const task of arr) {
        if (!task || !task.assignees) continue;
        task.assignees = task.assignees.map((a: any) => {
            if (typeof a !== 'object') return a;
            const uid = (a._id || a.id)?.toString();
            const photo = uid ? photoMap.get(uid) : undefined;
            return photo ? { ...a, profilePhoto: photo } : a;
        });
    }

    return tasks;
}

export interface CreateTaskData {
    title: string;
    description?: string;
    status?: 'todo' | 'in-progress' | 'paused' | 'completed';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    projectId?: string;
    parentTaskId?: string;
    startDate?: Date;
    endDate?: Date;
    deadline?: Date;
    estimatedHours?: number;
    assignees?: string[];
    createdBy: string;
    recurrence?: {
        frequency: 'daily' | 'weekly';
        endDate: string;
        daysOfWeek?: number[];
    };
}

export interface UpdateTaskData {
    title?: string;
    description?: string;
    status?: 'todo' | 'in-progress' | 'paused' | 'completed';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    startDate?: Date;
    endDate?: Date;
    deadline?: Date;
    estimatedHours?: number;
    projectId?: string;
    assignees?: string[];
    updatedBy?: string;
    /** true when the caller is a super-admin / admin / project-manager, bypasses
     *  the assignee-only status-change gate */
    isAdmin?: boolean;
}

export const createTask = async (data: CreateTaskData): Promise<ITask | ITask[]> => {
    if (data.recurrence) {
        const { frequency, endDate, daysOfWeek } = data.recurrence;
        const end = new Date(endDate);
        const start = data.startDate ? new Date(data.startDate) : new Date();
        
        // Ensure end is at the end of the day for inclusive comparison
        end.setHours(23, 59, 59, 999);

        const tasksToCreate: any[] = [];
        let current = new Date(start);
        
        // Loop up to max 365 days to prevent infinite loops
        let iterations = 0;
        const maxIterations = 365;

        while ((isBefore(current, end) || isSameDay(current, end)) && iterations < maxIterations) {
            iterations++;
            
            let shouldCreate = false;
            if (frequency === 'daily') {
                shouldCreate = true;
            } else if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
                if (daysOfWeek.includes(getDay(current))) {
                    shouldCreate = true;
                }
            }

            if (shouldCreate) {
                // Determine deadlines and start dates
                let taskStartDate = new Date(current);
                let taskDeadline: Date | undefined = undefined;
                
                if (data.deadline && data.startDate) {
                    const msDiff = new Date(data.deadline).getTime() - new Date(data.startDate).getTime();
                    taskDeadline = new Date(taskStartDate.getTime() + msDiff);
                } else if (data.deadline) {
                    // if no start date, assume deadline is same day as 'current'
                    taskDeadline = new Date(current);
                    taskDeadline.setHours(23, 59, 59, 999);
                }

                tasksToCreate.push({
                    ...data,
                    startDate: taskStartDate,
                    deadline: taskDeadline,
                    // we don't carry over 'recurrence' to DB since it's just a one-time generator
                });
            }

            current = addDays(current, 1);
        }

        if (tasksToCreate.length === 0) {
            // fallback if dates were weird
            tasksToCreate.push(data);
        }

        const tasks = await Task.insertMany(tasksToCreate);

        // Notify assignees (just once for the recurring series)
        if (data.assignees && data.assignees.length > 0 && data.projectId) {
            const project = await Project.findById(data.projectId).select('name').lean();
            const projectName = project?.name || 'a project';

            for (const userId of data.assignees) {
                if (userId === data.createdBy) continue;
                notificationService.createNotification({
                    userId,
                    type: 'task_assigned',
                    title: 'New Recurring Task Assigned',
                    message: `You have been assigned to a recurring task "${data.title}" in ${projectName}.`,
                    link: `/projects/${data.projectId}?tab=tasks`,
                    metadata: { projectId: data.projectId, taskTitle: data.title },
                });
            }
        }
        return tasks as any;
    }

    // --- Single Task Logic ---
    const task = await Task.create(data);

    // ── Auto-start timer if task is created with in-progress status ──────────
    if (data.status === 'in-progress' && data.createdBy) {
        const userIdObj = new Types.ObjectId(data.createdBy);
        task.activeTimers = [{ userId: userIdObj, startedAt: new Date() }];
        await task.save();
    }

    // ── Notify assignees about new task ──────────────────────────────────────
    if (data.assignees && data.assignees.length > 0 && data.projectId) {
        const project = await Project.findById(data.projectId).select('name').lean();
        const projectName = project?.name || 'a project';

        for (const userId of data.assignees) {
            if (userId === data.createdBy) continue;
            notificationService.createNotification({
                userId,
                type: 'task_assigned',
                title: 'New Task Assigned',
                message: `You have been assigned to "${task.title}" in ${projectName}.`,
                link: `/projects/${data.projectId}?tab=tasks&task=${task._id}`,
                metadata: {
                    taskId: task._id.toString(),
                    projectId: data.projectId,
                    taskTitle: task.title,
                },
            });
        }
    }

    return task;
};

export const getTasks = async (
    projectId: string,
    filters?: { status?: string; assignee?: string; includeSubtasks?: boolean }
): Promise<ITask[]> => {
    const query: any = { projectId };
    if (!filters?.includeSubtasks) query.parentTaskId = null; // Only main tasks unless requested

    if (filters?.status) query.status = filters.status;
    if (filters?.assignee) query.assignees = filters.assignee;

    const tasks = await Task.find(query)
        .populate('assignees', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean<any[]>();

    // Attach profile photos from Employee model
    await attachProfilePhotos(tasks);

    // For main-task queries, attach live subtask count per task
    if (!filters?.includeSubtasks && tasks.length > 0) {
        const taskIds = tasks.map((t: any) => t._id);
        const counts = await Task.aggregate([
            { $match: { parentTaskId: { $in: taskIds } } },
            { $group: { _id: '$parentTaskId', count: { $sum: 1 } } },
        ]);
        const countMap = new Map(counts.map((c: any) => [c._id.toString(), c.count]));
        return tasks.map((t: any) => ({
            ...t,
            subtaskCount: countMap.get(t._id.toString()) || 0,
        })) as any[];
    }

    return tasks as ITask[];
};

export const getIndividualTasks = async (
    userId: string,
    isAdmin: boolean,
    date?: string // YYYY-MM-DD — when provided, filter to tasks created on that day
): Promise<ITask[]> => {
    // Individual tasks typically have no projectId, but for admins requesting a specific date (Daily Overview), include all tasks.
    const query: any = {};
    if (!isAdmin || !date) {
        query.projectId = { $exists: false };
    }
    
    // If not admin, restrict to tasks created by or assigned to the user
    if (!isAdmin) {
        query.$or = [
            { createdBy: userId },
            { assignees: userId }
        ];
    }

    // Date filter: tasks created, updated, due, or completed on the given calendar day
    if (date) {
        const dayStart = new Date(date + 'T00:00:00.000Z');
        const dayEnd   = new Date(date + 'T23:59:59.999Z');
        
        const dateQuery = { $gte: dayStart, $lte: dayEnd };
        
        // Combine with the existing $or if it exists (for non-admins)
        const dateConditions: any[] = [
            { createdAt: dateQuery },
            { updatedAt: dateQuery },
            { deadline: dateQuery },
            { completedAt: dateQuery }
        ];

        // If the requested date is today, ALWAYS include tasks that are currently active
        // (even if they were created or last updated days ago)
        const now = new Date();
        // Since we don't know the exact client timezone, we can check if it's roughly today in UTC
        // or just use a simple heuristic. A better approach is to see if the date matches today's UTC or yesterday/tomorrow UTC bounds.
        // For simplicity, we just use the server's local date string.
        const serverToday = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        if (date === serverToday) {
            dateConditions.push({ status: 'in-progress' });
        }
        
        if (query.$or) {
            query.$and = [
                { $or: query.$or },
                { $or: dateConditions }
            ];
            delete query.$or;
        } else {
            query.$or = dateConditions;
        }
    }

    const tasks = await Task.find(query)
        .populate('assignees', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean<any[]>();

    await attachProfilePhotos(tasks);
    return tasks as ITask[];
};

export const getTaskById = async (taskId: string): Promise<ITask | null> => {
    const task = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email')
        .lean<any>();

    if (task) await attachProfilePhotos(task);
    return task;
};

export const updateTask = async (
    taskId: string,
    data: UpdateTaskData
): Promise<ITask | null> => {
    const task = await Task.findById(taskId);
    if (!task) return null;

    const previousStatus = task.status;
    const newStatus = data.status || previousStatus;

    // No status locks — any authenticated user can change any status freely.


    // Apply remaining field updates
    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.status !== undefined) task.status = data.status;
    if (data.priority !== undefined) task.priority = data.priority;
    if (data.projectId !== undefined) {
        task.projectId = data.projectId ? new Types.ObjectId(data.projectId) : undefined;
    }
    if (data.startDate !== undefined) task.startDate = data.startDate;
    if (data.endDate !== undefined) task.endDate = data.endDate;
    if (data.deadline !== undefined) task.deadline = data.deadline;
    if (data.estimatedHours !== undefined) task.estimatedHours = data.estimatedHours;

    // ── Notify new assignees when assignees are updated ──────────────────────
    if (data.assignees !== undefined) {
        const previousAssignees = task.assignees.map((a) => a.toString());
        const newAssignees = data.assignees.filter((id) => !previousAssignees.includes(id));

        if (newAssignees.length > 0) {
            const project = task.projectId ? await Project.findById(task.projectId).select('name').lean() : null;
            const projectName = project?.name || 'an individual task';

            for (const userId of newAssignees) {
                notificationService.createNotification({
                    userId,
                    type: 'task_assigned',
                    title: 'New Task Assigned',
                    message: `You have been assigned to "${task.title}" in ${projectName}.`,
                    link: task.projectId ? `/projects/${task.projectId}?tab=tasks&task=${task._id}` : `/projects/tasks`,
                    metadata: {
                        taskId: task._id.toString(),
                        projectId: task.projectId ? task.projectId.toString() : '',
                        taskTitle: task.title,
                    },
                });
            }
        }

        task.assignees = data.assignees.map((id: string) => new Types.ObjectId(id));
    }

    await task.save();

    // ── Auto-update parent task status if this is a subtask ──────────────────
    // Parent status is purely computed from its children:
    //   all completed → completed | any in-progress → in-progress |
    //   any paused (none in-progress) → paused | else → todo
    const effectiveNewStatus = data.status || previousStatus;
    if (task.parentTaskId && effectiveNewStatus !== previousStatus) {
        const siblings = await Task.find({ parentTaskId: task.parentTaskId }).lean<{ status: string }[]>();
        if (siblings.length > 0) {
            const statuses = siblings.map(s => s.status);
            const parentStatus =
                statuses.every(s => s === 'completed') ? 'completed' :
                statuses.some(s => s === 'in-progress') ? 'in-progress' :
                statuses.some(s => s === 'paused') ? 'paused' : 'todo';
            const parentTask = await Task.findById(task.parentTaskId);
            if (parentTask && parentTask.status !== parentStatus) {
                parentTask.status = parentStatus as any;
                await parentTask.save(); // pre-save hook sets completedAt on completed
            }
        }
    }

    // Re-fetch with populated fields so the API response matches what getTasks returns
    const updated = await Task.findById(task._id)
        .populate('assignees', 'name email')
        .populate('createdBy', 'name email')
        .lean<any>();
    if (updated) await attachProfilePhotos(updated);
    return updated;
};

export const deleteTask = async (taskId: string): Promise<void> => {
    // Delete task and all its subtasks
    await Task.deleteMany({ $or: [{ _id: taskId }, { parentTaskId: taskId }] });
};

export const getSubtasks = async (parentTaskId: string): Promise<ITask[]> => {
    const subtasks = await Task.find({ parentTaskId })
        .populate('assignees', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: 1 })
        .lean<any[]>();

    await attachProfilePhotos(subtasks);
    return subtasks as any;
};
