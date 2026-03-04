import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { holidayService } from '../services/holiday.service';

// ── Create Holiday ─────────────────────────────────────────────────────
export const createHoliday = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id || (req.user as any)._id;
    const holiday = await holidayService.createHoliday(req.body, userId.toString());
    res.status(201).json({ status: 'success', data: { holiday } });
});

// ── List Holidays ──────────────────────────────────────────────────────
export const getHolidays = asyncHandler(async (req: Request, res: Response) => {
    const { year, month, type, upcoming } = req.query;
    const holidays = await holidayService.getHolidays({
        year: year ? parseInt(year as string) : undefined,
        month: month ? parseInt(month as string) : undefined,
        type: type as string | undefined,
        upcoming: upcoming === 'true',
    });
    res.json({ status: 'success', data: { holidays } });
});

// ── Update Holiday ─────────────────────────────────────────────────────
export const updateHoliday = asyncHandler(async (req: Request, res: Response) => {
    const holiday = await holidayService.updateHoliday(req.params.id, req.body);
    res.json({ status: 'success', data: { holiday } });
});

// ── Delete Holiday ─────────────────────────────────────────────────────
export const deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
    await holidayService.deleteHoliday(req.params.id);
    res.json({ status: 'success', message: 'Holiday deleted successfully' });
});
