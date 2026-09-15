import { Request, Response, NextFunction } from 'express';
import * as taskService from '../services/task.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { Employee } from '../../hrms/models/Employee.model';
import { Project } from '../models/Project.model';
import { Task } from '../models/Task.model';
import { TimeLog } from '../models/TimeLog.model';
import { DaySession } from '../models/DaySession.model';
import { AttendanceService } from '../../hrms/services/attendance.service';
import mongoose from 'mongoose';
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

        if (session) {
            if (session.dayStart || session.status === 'running' || (session.accumulated && session.accumulated > 0)) {
                AttendanceService.syncCheckInFromTimer(userId, dateKey, session.dayStart || new Date()).catch(() => {});
            }
            if (session.isEnded) {
                AttendanceService.syncCheckOutFromTimer(
                    userId,
                    dateKey,
                    session.lastPausedAt || new Date(),
                    session.accumulated || 0,
                    session.breakAccumulated || 0
                ).catch(() => {});
            }
        }

        let data: any = session ?? null;
        if (data) {
            if (data.isEnded && !data.lastEndedAccumulated) {
                data.lastEndedAccumulated = data.accumulated || 0;
                data.lastEndedBreakAccumulated = data.breakAccumulated || 0;
            }
        }

        res.status(200).json({ success: true, data });
    }
);

/**
 * POST /projects/day-session/start
 * Starts or resumes today's DaySession.
 * - If no session for today exists, creates one (accumulated = 0).
 * - If session exists and was ended, records lastEndedAccumulated & resumes session.
 * - If session exists and is paused, resumes it (sets startedAt = now, status = running).
 * - If session already running, no-ops gracefully (idempotent).
 */
export const startDaySession = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();
        const now = Date.now();

        const current = await DaySession.findOne({ userId, dateKey });
        if (current) {
            let needsSave = false;

            // If the user previously ended the day and is starting again today:
            if (current.isEnded) {
                if (!current.lastEndedAccumulated) {
                    current.lastEndedAccumulated = current.accumulated || 0;
                }
                if (!current.lastEndedBreakAccumulated) {
                    current.lastEndedBreakAccumulated = current.breakAccumulated || 0;
                }
                if (!current.lastLapseElapsed || current.lastLapseElapsed < current.lastEndedAccumulated) {
                    current.lastLapseElapsed = current.lastEndedAccumulated;
                }
                if (!current.lastLapseBreak || current.lastLapseBreak < current.lastEndedBreakAccumulated) {
                    current.lastLapseBreak = current.lastEndedBreakAccumulated;
                }
                current.isEnded = false;
                needsSave = true;
            }

            // CRITICAL: Only set startedAt = now if NOT already running!
            // If the session is already running, startedAt MUST be preserved
            // to avoid wiping out the current running time on page refresh or redundant start calls.
            if (current.status !== 'running') {
                current.status = 'running';
                current.startedAt = now;
                needsSave = true;
            } else if (!current.startedAt) {
                // Defensive: status was running but startedAt was missing
                current.startedAt = now;
                needsSave = true;
            }

            if (needsSave) {
                await current.save();
            }

            // Sync check-in to Attendance database
            await AttendanceService.syncCheckInFromTimer(userId, dateKey, current.dayStart || new Date());

            timerStatusMap.set(userId, 'running');
            return res.status(200).json({ success: true, data: current.toObject() });
        }

        const session = await DaySession.create({
            userId,
            dateKey,
            dayStart: new Date(),
            accumulated: 0,
            limitBypassed: false,
            status: 'running',
            startedAt: now,
            lastEndedAccumulated: 0,
            lastEndedBreakAccumulated: 0,
            allocatedSeconds: 0,
        });

        // Sync check-in to Attendance database
        await AttendanceService.syncCheckInFromTimer(userId, dateKey, session.dayStart);

        timerStatusMap.set(userId, 'running');
        res.status(200).json({ success: true, data: session.toObject() });
    }
);

/**
 * PATCH /projects/day-session/pause
 * Pauses the running DaySession and accumulates elapsed seconds.
 * Body: { accumulated?: number, isEnded?: boolean, allocatedMinutes?: number }
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

        // If user is currently on break (and not ending the day), do not pause the day timer
        if (current.breakStartedAt && req.body?.isEnded !== true) {
            return res.status(200).json({ success: true, data: current.toObject() });
        }

        if (current.status === 'running' && current.startedAt) {
            const runSeconds = Math.max(0, Math.floor((now - current.startedAt) / 1000));
            current.accumulated = current.accumulated + runSeconds;
            current.status = 'paused';
            current.startedAt = null;
            current.lastPausedAt = new Date();
        } else if (typeof req.body?.accumulated === 'number' && req.body.accumulated > current.accumulated) {
            current.accumulated = req.body.accumulated;
        }

        if (req.body?.isEnded === true) {
            current.isEnded = true;
            // If on break while ending day, end the break as well
            if (current.breakStartedAt) {
                const breakSec = Math.max(0, Math.floor((now - current.breakStartedAt) / 1000));
                current.breakAccumulated = (current.breakAccumulated || 0) + breakSec;
                current.breakStartedAt = null;
                current.breakType = null;
                current.breakReason = null;
            }
            current.lastEndedAccumulated = current.accumulated;
            current.lastEndedBreakAccumulated = current.breakAccumulated || 0;
            current.lastLapseElapsed = Math.max(current.lastLapseElapsed || 0, current.accumulated || 0);
            current.lastLapseBreak = Math.max(current.lastLapseBreak || 0, current.breakAccumulated || 0);
            if (req.body?.allocatedMinutes) {
                current.allocatedSeconds = (current.allocatedSeconds || 0) + (req.body.allocatedMinutes * 60);
            }
        }

        await current.save();

        if (req.body?.isEnded === true) {
            // Sync check-out to Attendance database
            await AttendanceService.syncCheckOutFromTimer(
                userId,
                dateKey,
                new Date(),
                current.accumulated || 0,
                current.breakAccumulated || 0
            );
        }

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

        const current = await DaySession.findOne({ userId, dateKey });
        if (!current) {
            return res.status(200).json({ success: true, data: null });
        }

        current.limitBypassed = true;
        if (current.status !== 'running') {
            current.status = 'running';
            current.startedAt = now;
        }
        await current.save();

        res.status(200).json({ success: true, data: current.toObject() });
    }
);

/**
 * POST /projects/day-session/break/start
 * Starts a break for the user today.
 * Body: { breakType: 'lunch' | 'tea' | 'other', reason?: string }
 */
export const startBreak = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();
        const now = Date.now();
        const { breakType = 'lunch', reason = null } = req.body || {};

        // Find or create day session
        let session = await DaySession.findOne({ userId, dateKey });
        if (!session) {
            session = new DaySession({
                userId,
                dateKey,
                dayStart: new Date(),
                status: 'running',
                startedAt: now,
                accumulated: 0,
                breakAccumulated: 0,
                breakStartedAt: now,
                breakType,
                breakReason: reason,
            });
            await session.save();
            await AttendanceService.syncCheckInFromTimer(userId, dateKey, session.dayStart);
        } else {
            // If already on break, update break type/reason
            if (!session.breakStartedAt) {
                session.breakStartedAt = now;
            }
            session.breakType = breakType;
            session.breakReason = reason;

            // Timer must always stay running on break
            if (session.status !== 'running') {
                session.status = 'running';
                session.startedAt = now;
            }
            await session.save();
        }

        res.status(200).json({ success: true, data: session.toObject() });
    }
);

/**
 * POST /projects/day-session/break/end
 * Ends the user's active break and accumulates duration.
 */
export const endBreak = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();
        const now = Date.now();

        const session = await DaySession.findOne({ userId, dateKey });
        if (!session) {
            return res.status(200).json({ success: true, data: null });
        }

        if (session.breakStartedAt) {
            const breakSec = Math.max(0, Math.floor((now - session.breakStartedAt) / 1000));
            session.breakAccumulated = (session.breakAccumulated || 0) + breakSec;
            session.breakStartedAt = null;
            session.breakType = null;
            session.breakReason = null;
            if (session.status !== 'running' && !session.isEnded) {
                session.status = 'running';
                session.startedAt = now;
            }
            await session.save();
        }

        res.status(200).json({ success: true, data: session.toObject() });
    }
);

/**
 * POST /projects/day-session/lapse
 * Records or updates a lapse in today's DaySession, updating the lapse boundary.
 */
export const recordLapse = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();
        const { lapse, lastLapseElapsed, lastLapseBreak } = req.body || {};

        if (!lapse || !lapse.id || typeof lapse.seconds !== 'number') {
            return res.status(400).json({ success: false, message: 'Invalid lapse payload' });
        }

        let session = await DaySession.findOne({ userId, dateKey });
        if (!session) {
            session = new DaySession({
                userId,
                dateKey,
                dayStart: new Date(),
                status: 'paused',
                accumulated: 0,
                breakAccumulated: 0,
                lapses: [],
            });
        }

        if (!Array.isArray(session.lapses)) {
            session.lapses = [];
        }

        const existingIdx = session.lapses.findIndex(l => l.id === lapse.id);
        if (existingIdx >= 0) {
            session.lapses[existingIdx] = {
                ...session.lapses[existingIdx],
                ...lapse,
            };
        } else {
            session.lapses.push({
                id: lapse.id,
                seconds: lapse.seconds,
                capturedAt: lapse.capturedAt || new Date().toISOString(),
                assignedTaskId: lapse.assignedTaskId || null,
                assignedProjectId: lapse.assignedProjectId || null,
                note: lapse.note || null,
            });
        }

        if (typeof lastLapseElapsed === 'number') {
            session.lastLapseElapsed = lastLapseElapsed;
        }
        if (typeof lastLapseBreak === 'number') {
            session.lastLapseBreak = lastLapseBreak;
        }

        await session.save();
        res.status(200).json({ success: true, data: session.toObject() });
    }
);

/**
 * PATCH /projects/day-session/lapse/:id/assign
 * Assigns a previously recorded lapse to a task.
 */
export const assignLapseSession = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();
        const { id } = req.params;
        const { assignedTaskId, assignedProjectId, note } = req.body || {};

        const session = await DaySession.findOne({ userId, dateKey });
        if (!session) {
            return res.status(404).json({ success: false, message: 'DaySession not found' });
        }

        if (!Array.isArray(session.lapses)) {
            session.lapses = [];
        }

        const target = session.lapses.find(l => l.id === id);
        if (!target) {
            return res.status(404).json({ success: false, message: 'Lapse record not found' });
        }

        target.assignedTaskId = assignedTaskId || null;
        target.assignedProjectId = assignedProjectId || null;
        if (note !== undefined) {
            target.note = note || null;
        }

        await session.save();
        res.status(200).json({ success: true, data: session.toObject() });
    }
);

/**
 * POST /projects/day-session/lapse-boundary
 * Advances the lapse boundary (lastLapseElapsed, lastLapseBreak) without creating a new lapse.
 */
export const updateLapseBoundary = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const dateKey = getTodayKey();
        const { lastLapseElapsed, lastLapseBreak } = req.body || {};

        let session = await DaySession.findOne({ userId, dateKey });
        if (!session) {
            return res.status(200).json({ success: true, data: null });
        }

        if (typeof lastLapseElapsed === 'number') {
            session.lastLapseElapsed = Math.max(session.lastLapseElapsed || 0, lastLapseElapsed);
        }
        if (typeof lastLapseBreak === 'number') {
            session.lastLapseBreak = Math.max(session.lastLapseBreak || 0, lastLapseBreak);
        }

        await session.save();
        res.status(200).json({ success: true, data: session.toObject() });
    }
);


