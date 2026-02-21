import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/attendance.service';
import asyncHandler from '../../../utils/asyncHandler';

export const checkIn = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const data = req.body;
    const userId = req.user!.id;

    const attendance = await AttendanceService.checkIn(userId, data);

    res.status(201).json({
        status: 'success',
        data: attendance,
    });
});

export const checkOut = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const data = req.body;
    const userId = req.user!.id;

    const attendance = await AttendanceService.checkOut(userId, data);

    res.status(200).json({
        status: 'success',
        data: attendance,
    });
});

export const getMyAttendance = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    const records = await AttendanceService.getMyAttendance(
        userId,
        startDate as string,
        endDate as string
    );

    res.status(200).json({
        status: 'success',
        results: records.length,
        data: records,
    });
});

export const getEmployeeAttendance = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const records = await AttendanceService.getEmployeeAttendance(
        id,
        startDate as string,
        endDate as string
    );

    res.status(200).json({
        status: 'success',
        results: records.length,
        data: records,
    });
});
