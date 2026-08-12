import { Request, Response, NextFunction } from 'express';
import * as taskService from '../services/task.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { Employee } from '../../hrms/models/Employee.model';
import { Project } from '../models/Project.model';
import { Task } from '../models/Task.model';

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
        const isAdmin = ['super-admin', 'super_admin', 'admin'].includes(userRole);
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
