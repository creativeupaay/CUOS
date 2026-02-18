import { Request, Response, NextFunction } from 'express';
import * as meetingService from '../services/meeting.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';

export const createMeeting = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const meeting = await meetingService.createMeeting({
            ...req.body,
            projectId: req.params.projectId,
            createdBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Meeting created successfully',
            data: meeting,
        });
    }
);

export const getMeetings = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;
        const userRole = req.user?.role!;

        const meetings = await meetingService.getMeetings(
            req.params.projectId,
            userId,
            userRole,
            {
                type: req.query.type as 'internal' | 'external',
                startDate: req.query.startDate
                    ? new Date(req.query.startDate as string)
                    : undefined,
                endDate: req.query.endDate
                    ? new Date(req.query.endDate as string)
                    : undefined,
            }
        );

        res.status(200).json({
            success: true,
            message: 'Meetings retrieved successfully',
            data: meetings,
        });
    }
);

export const getMeetingById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const meeting = await meetingService.getMeetingById(req.params.id);

        if (!meeting) {
            return next(new AppError('Meeting not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Meeting retrieved successfully',
            data: meeting,
        });
    }
);

export const updateMeeting = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const meeting = await meetingService.updateMeeting(
            req.params.id,
            req.body
        );

        if (!meeting) {
            return next(new AppError('Meeting not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Meeting updated successfully',
            data: meeting,
        });
    }
);

export const deleteMeeting = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        await meetingService.deleteMeeting(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Meeting deleted successfully',
        });
    }
);
