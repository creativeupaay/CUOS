import { Request, Response, NextFunction } from 'express';
import * as timeLogService from '../services/timeLog.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';

export const createTimeLog = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const timeLog = await timeLogService.createTimeLog({
            ...req.body,
            projectId: req.params.projectId,
            taskId: req.params.taskId,
            userId,
        });

        res.status(201).json({
            success: true,
            message: 'Time log created successfully',
            data: timeLog,
        });
    }
);

export const getProjectTimeLogs = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const timeLogs = await timeLogService.getProjectTimeLogs(
            req.params.projectId,
            {
                userId: req.query.userId as string,
                startDate: req.query.startDate
                    ? new Date(req.query.startDate as string)
                    : undefined,
                endDate: req.query.endDate
                    ? new Date(req.query.endDate as string)
                    : undefined,
                billable: req.query.billable === 'true' ? true : req.query.billable === 'false' ? false : undefined,
            }
        );

        res.status(200).json({
            success: true,
            message: 'Time logs retrieved successfully',
            data: timeLogs,
        });
    }
);

export const getTaskTimeLogs = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const timeLogs = await timeLogService.getTaskTimeLogs(req.params.taskId);

        res.status(200).json({
            success: true,
            message: 'Task time logs retrieved successfully',
            data: timeLogs,
        });
    }
);

export const getMyTimeLogs = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const timeLogs = await timeLogService.getMyTimeLogs(userId, {
            startDate: req.query.startDate
                ? new Date(req.query.startDate as string)
                : undefined,
            endDate: req.query.endDate
                ? new Date(req.query.endDate as string)
                : undefined,
            projectId: req.query.projectId as string,
        });

        res.status(200).json({
            success: true,
            message: 'Your time logs retrieved successfully',
            data: timeLogs,
        });
    }
);

export const updateTimeLog = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const timeLog = await timeLogService.updateTimeLog(req.params.id, req.body);

        if (!timeLog) {
            return next(new AppError('Time log not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Time log updated successfully',
            data: timeLog,
        });
    }
);

export const deleteTimeLog = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        await timeLogService.deleteTimeLog(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Time log deleted successfully',
        });
    }
);
