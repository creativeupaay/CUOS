import { Request, Response, NextFunction } from 'express';
import * as taskService from '../services/task.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';

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

export const getTasks = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const tasks = await taskService.getTasks(req.params.projectId, {
            status: req.query.status as string,
            assignee: req.query.assignee as string,
        });

        res.status(200).json({
            success: true,
            message: 'Tasks retrieved successfully',
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
        const task = await taskService.updateTask(req.params.taskId, req.body);

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
