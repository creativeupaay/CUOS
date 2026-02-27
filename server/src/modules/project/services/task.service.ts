import { Task, ITask } from '../models/Task.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import * as timeLogService from './timeLog.service';

export interface CreateTaskData {
    title: string;
    description?: string;
    status?: 'todo' | 'in-progress' | 'paused' | 'completed';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    projectId: string;
    parentTaskId?: string;
    startDate?: Date;
    endDate?: Date;
    deadline?: Date;
    estimatedHours?: number;
    assignees?: string[];
    createdBy: string;
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
    assignees?: string[];
    updatedBy?: string;
    /** true when the caller is a super-admin / admin / project-manager, bypasses
     *  the assignee-only status-change gate */
    isAdmin?: boolean;
}

export const createTask = async (data: CreateTaskData): Promise<ITask> => {
    const task = await Task.create(data);
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

    return tasks as any[];
};

export const getTaskById = async (taskId: string): Promise<ITask | null> => {
    const task = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email');

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

    // ── Lock: once completed, status cannot be changed ─────────────────────
    if (previousStatus === 'completed' && data.status && data.status !== 'completed') {
        // Silently ignore status-only changes on completed tasks.
        // Non-status fields (title, description, etc.) can still be updated by admins.
        delete data.status;
    }

    // ── Assignee gate: only task assignees (or admins) may change status ────
    if (data.status && data.status !== previousStatus && data.updatedBy && !data.isAdmin) {
        const isAssignee = task.assignees.some(
            (a) => a.toString() === data.updatedBy
        );
        if (!isAssignee) {
            throw new AppError('Only assigned team members can change this task\'s status', 403);
        }
    }

    // ── Timer automation (only when status actually changes) ────────────────
    const effectiveNewStatus = data.status || previousStatus;
    if (effectiveNewStatus !== previousStatus && data.updatedBy) {
        const userIdObj = new Types.ObjectId(data.updatedBy);
        task.activeTimers = task.activeTimers || [];
        task.accumulatedSeconds = task.accumulatedSeconds || [];

        if (effectiveNewStatus === 'in-progress') {
            // Resume or start: push a fresh active-timer entry (accumulated seconds
            // are already stored in accumulatedSeconds from previous sessions).
            const alreadyActive = task.activeTimers.find(
                t => t.userId.toString() === data.updatedBy
            );
            if (!alreadyActive) {
                task.activeTimers.push({ userId: userIdObj, startedAt: new Date() });
            }
        } else if (
            effectiveNewStatus === 'paused' ||
            effectiveNewStatus === 'completed'
        ) {
            const timerIndex = task.activeTimers.findIndex(
                t => t.userId.toString() === data.updatedBy
            );

            if (timerIndex !== -1) {
                const timer = task.activeTimers[timerIndex];
                const endTime = new Date();
                const sessionSecs = Math.max(
                    0,
                    Math.floor((endTime.getTime() - timer.startedAt.getTime()) / 1000)
                );
                // Use rounded-up minutes for billing purposes in TimeLog
                const sessionMinsForLog = Math.max(1, Math.round(sessionSecs / 60));

                // Persist this session to TimeLog (duration in minutes for finance)
                await timeLogService.createTimeLog({
                    projectId: task.projectId.toString(),
                    taskId: task._id.toString(),
                    userId: data.updatedBy,
                    date: new Date(),
                    duration: sessionMinsForLog,
                    startTime: timer.startedAt,
                    endTime,
                    description:
                        effectiveNewStatus === 'completed'
                            ? 'Task completed'
                            : 'Session paused',
                });

                // Accumulate per-user total in SECONDS on the task document
                const accEntry = task.accumulatedSeconds.find(
                    a => a.userId.toString() === data.updatedBy
                );
                if (accEntry) {
                    accEntry.seconds += sessionSecs;
                } else {
                    task.accumulatedSeconds.push({
                        userId: userIdObj,
                        seconds: sessionSecs,
                    });
                }

                // Remove the active timer
                task.activeTimers.splice(timerIndex, 1);
            }
        }
    }

    // Apply remaining field updates
    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.status !== undefined) task.status = data.status;
    if (data.priority !== undefined) task.priority = data.priority;
    if (data.startDate !== undefined) task.startDate = data.startDate;
    if (data.endDate !== undefined) task.endDate = data.endDate;
    if (data.deadline !== undefined) task.deadline = data.deadline;
    if (data.estimatedHours !== undefined) task.estimatedHours = data.estimatedHours;
    if (data.assignees !== undefined)
        task.assignees = data.assignees.map((id: string) => new Types.ObjectId(id));

    await task.save();

    // ── Auto-update parent task status if this is a subtask ──────────────────
    // Parent status is purely computed from its children:
    //   all completed → completed | any in-progress → in-progress |
    //   any paused (none in-progress) → paused | else → todo
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
    return Task.findById(task._id)
        .populate('assignees', 'name email')
        .populate('createdBy', 'name email');
};

export const deleteTask = async (taskId: string): Promise<void> => {
    // Delete task and all its subtasks
    await Task.deleteMany({ $or: [{ _id: taskId }, { parentTaskId: taskId }] });
};

export const getSubtasks = async (parentTaskId: string): Promise<ITask[]> => {
    const subtasks = await Task.find({ parentTaskId })
        .populate('assignees', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: 1 });

    return subtasks;
};
