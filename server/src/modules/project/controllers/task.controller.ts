import { Request, Response, NextFunction } from 'express';
import * as taskService from '../services/task.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { Employee } from '../../hrms/models/Employee.model';
import { Project } from '../models/Project.model';
import { Task } from '../models/Task.model';
import { DaySession } from '../models/DaySession.model';
import { getAccessibleProjectIds } from '../middlewares/projectAccess.middleware';
import { getWorkDayLabel } from '../../../utils/intervalUtils';
import { hasModuleAdminAccess, hasModuleViewAccess } from '../../../utils/moduleAccess.util';

// ── Date helper ────────────────────────────────────────────────────────────────
/** Returns the 6am-IST (00:30 UTC) work day label 'YYYY-MM-DD'. Used as the dateKey for DaySessions. */
function getTodayKey(): string {
    return getWorkDayLabel(new Date());
}

export const createTask = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const task = await taskService.createTask({
            ...req.body,
            projectId: req.params.projectId,
            createdBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: task,
        });
    }
);

export const createIndividualTask = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const task = await taskService.createTask({
            ...req.body,
            createdBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Individual task created successfully',
            data: task,
        });
    }
);

export const getTasks = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const tasks = await taskService.getTasks(req.params.projectId, {
            status: req.query.status as string,
            assignee: req.query.assignee as string,
            includeSubtasks: req.query.includeSubtasks === 'true',
        });

        res.status(200).json({
            success: true,
            message: 'Tasks retrieved successfully',
            data: tasks,
        });
    }
);

export const getAllTasks = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const projectIds = (req.query.projectIds as string)?.split(',').filter(Boolean) || [];
        if (projectIds.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No project IDs provided',
                data: [],
            });
        }
        
        const validProjectIds = await getAccessibleProjectIds(req, projectIds);
        if (validProjectIds.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No accessible projects found',
                data: [],
            });
        }

        const tasks = await taskService.getAllTasksForProjects(validProjectIds);

        res.status(200).json({
            success: true,
            message: 'Global tasks retrieved successfully',
            data: tasks,
        });
    }
);

export const getIndividualTasks = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;
        const roleRaw = req.user?.role;
        const userRole =
            typeof roleRaw === 'string'
                ? roleRaw.toLowerCase()
                : typeof roleRaw === 'object' && roleRaw
                    ? String((roleRaw as any).name || '').toLowerCase()
                    : '';
        const isGlobalAdmin = ['super-admin', 'super_admin', 'admin'].includes(userRole);
        const isPmAdmin = hasModuleAdminAccess(req.user, 'projectManagement');
        const isHrAdmin = hasModuleAdminAccess(req.user, 'hrms') || hasModuleViewAccess(req.user, 'hrms');
        const isAdmin = isGlobalAdmin || isPmAdmin || isHrAdmin;
        const date = typeof req.query.date === 'string' ? req.query.date : undefined;

        const tasks = await taskService.getIndividualTasks(userId, isAdmin, date);

        res.status(200).json({
            success: true,
            message: 'Individual tasks retrieved successfully',
            data: tasks,
        });
    }
);

export const getTaskById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const task = await taskService.getTaskById(req.params.taskId);

        if (!task) {
            return next(new AppError('Task not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Task retrieved successfully',
            data: task,
        });
    }
);

export const updateTask = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;
        const roleRaw = req.user?.role;
        const userRole =
            typeof roleRaw === 'string'
                ? roleRaw.toLowerCase()
                : typeof roleRaw === 'object' && roleRaw
                    ? String((roleRaw as any).name || '').toLowerCase()
                    : '';

        // Only true admins or project managers bypass the assignee-only status gate.
        // Project members can still edit metadata via checkTaskAccess, but status changes
        // remain restricted inside the service.
        let isAdmin = ['super-admin', 'super_admin', 'admin'].includes(userRole);

        if (!isAdmin) {
            const task = await Task.findById(req.params.taskId).select('projectId createdBy').lean();
            if (task) {
                // If it's an individual task, allow the creator
                if (!task.projectId) {
                    if (task.createdBy?.toString() === userId) {
                        isAdmin = true; // treat creator as admin for their own individual task
                    }
                } else {
                    const employee = await Employee.findOne({ userId }).select('_id').lean();
                    if (employee) {
                        const project = await Project.findById(task.projectId).select('assignees').lean();
                        const assignment = (project as any)?.assignees?.find(
                            (a: any) => a.employeeId?.toString() === (employee as any)._id?.toString()
                        );
                        if (assignment?.role === 'manager') {
                            isAdmin = true;
                        }
                    }
                }
            }
        }

        const task = await taskService.updateTask(req.params.taskId, { ...req.body, updatedBy: userId, isAdmin });

        if (!task) {
            return next(new AppError('Task not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            data: task,
        });
    }
);


export const deleteTask = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        // Enforce delete permissions
        const userId = req.user?.id!;
        const roleRaw = req.user?.role;
        const userRole =
            typeof roleRaw === 'string'
                ? roleRaw.toLowerCase()
                : typeof roleRaw === 'object' && roleRaw
                    ? String((roleRaw as any).name || '').toLowerCase()
                    : '';
        
        let isAdmin = ['super-admin', 'super_admin', 'admin'].includes(userRole);
        
        const task = await Task.findById(req.params.taskId).select('projectId createdBy').lean();
        if (!task) {
            return next(new AppError('Task not found', 404));
        }

        if (!isAdmin) {
            // Creators can delete their own tasks
            if (task.createdBy?.toString() === userId) {
                isAdmin = true;
            }
        }

        if (!isAdmin) {
            return next(new AppError('You do not have permission to delete this task', 403));
        }

        await taskService.deleteTask(req.params.taskId);

        res.status(200).json({
            success: true,
            message: 'Task deleted successfully',
        });
    }
);

export const createSubtask = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const subtask = await taskService.createTask({
            ...req.body,
            projectId: req.params.projectId,
            parentTaskId: req.params.taskId,
            createdBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Subtask created successfully',
            data: subtask,
        });
    }
);

export const getSubtasks = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const subtasks = await taskService.getSubtasks(req.params.taskId);

        res.status(200).json({
            success: true,
            message: 'Subtasks retrieved successfully',
            data: subtasks,
        });
    }
);

// ── Timer Status Tracking ──────────────────────────────────────────────────
// A simple in-memory map: userId → 'running' | 'paused'
// This is deliberately NOT persisted — it resets on server restart,
// which is the correct behaviour (no stale "working" status after restart).
const timerStatusMap = new Map<string, 'running' | 'paused'>();

/** POST /projects/timer-status — called by the client when timer starts/pauses/resumes */
export const setTimerStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const { status } = req.body as { status: 'running' | 'paused' };
        
        console.log(`[TimerStatus] Setting status for user ${userId} to ${status}`);

        if (status === 'running') {
            timerStatusMap.set(userId, 'running');
        } else {
            timerStatusMap.delete(userId); // remove = not running
        }

        res.status(200).json({ success: true, data: { status } });
    }
);

/** GET /projects/timer-status — admin can see who's running a timer or checked out */
export const getTimerStatuses = asyncHandler(
    async (_req: Request, res: Response) => {
        const dateKey = getTodayKey();
        const sessions = await DaySession.find({ dateKey }).lean();
        
        const result: Record<string, { status: string; isEnded: boolean }> = {};
        sessions.forEach(session => {
            result[session.userId.toString()] = { 
                status: session.status,
                isEnded: session.isEnded || false
            };
        });
        
        res.status(200).json({ success: true, data: result });
    }
);

// ── DaySession Endpoints ───────────────────────────────────────────────────────

/**
 * GET /projects/day-session
 * Returns today's DaySession for the authenticated user.
 * Returns null if not started yet today.
 */
export const getDaySession = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();

        const session = await DaySession.findOne({ userId, dateKey }).lean();
        res.status(200).json({ success: true, data: session ?? null });
    }
);

/**
 * POST /projects/day-session/start
 * Starts or resumes today's DaySession.
 * - If no session for today exists, creates one (accumulated = 0).
 * - If session exists and is paused, resumes it (sets startedAt = now, status = running).
 * - If session already running, no-ops gracefully (idempotent).
 */
export const startDaySession = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();
        const now = Date.now();

        const session = await DaySession.findOneAndUpdate(
            { userId, dateKey },
            {
                $setOnInsert: { dayStart: new Date(), accumulated: 0, limitBypassed: false },
                $set: {
                    status: 'running',
                    startedAt: now,
                },
            },
            { upsert: true, new: true }
        ).lean();

        // Also update in-memory status map for backward compatibility
        timerStatusMap.set(userId, 'running');

        res.status(200).json({ success: true, data: session });
    }
);

/**
 * PATCH /projects/day-session/pause
 * Pauses the running DaySession and accumulates elapsed seconds.
 * Body: { accumulated?: number } — if client sends accumulated, we trust it;
 *       otherwise we compute it server-side from startedAt.
 */
export const pauseDaySession = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();
        const now = Date.now();

        const current = await DaySession.findOne({ userId, dateKey });
        if (!current) {
            return res.status(200).json({ success: true, data: null });
        }

        if (current.status === 'running' && current.startedAt) {
            const runSeconds = Math.floor((now - current.startedAt) / 1000);
            current.accumulated = current.accumulated + runSeconds;
            current.status = 'paused';
            current.startedAt = null;
            current.lastPausedAt = new Date();
        }

        if (req.body?.isEnded === true) {
            current.isEnded = true;
        }

        await current.save();

        // Update in-memory status map
        timerStatusMap.delete(userId);

        res.status(200).json({ success: true, data: current.toObject() });
    }
);

/**
 * PATCH /projects/day-session/bypass-limit
 * Allows the user to bypass the 12-hour cap and keep running.
 */
export const bypassDaySessionLimit = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();
        const now = Date.now();

        const session = await DaySession.findOneAndUpdate(
            { userId, dateKey },
            { $set: { limitBypassed: true, status: 'running', startedAt: now } },
            { new: true }
        ).lean();

        res.status(200).json({ success: true, data: session });
    }
);
