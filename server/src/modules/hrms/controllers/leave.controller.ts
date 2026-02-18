import { Request, Response, NextFunction } from 'express';
import { leaveService } from '../services/leave.service';
import asyncHandler from '../../../utils/asyncHandler';

// ── Create Leave Request ────────────────────────────────────────────
export const createLeave = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const leave = await leaveService.createLeave(req.body, userId);

    res.status(201).json({
        status: 'success',
        data: { leave },
    });
});

// ── Get All Leaves (admin/HR) ───────────────────────────────────────
export const getLeaves = asyncHandler(async (req: Request, res: Response) => {
    const { employeeId, status, type, page, limit } = req.query;
    const result = await leaveService.getLeaves({
        employeeId: employeeId as string,
        status: status as string,
        type: type as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
        status: 'success',
        data: result,
    });
});

// ── Get My Leaves ───────────────────────────────────────────────────
export const getMyLeaves = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { status, page, limit } = req.query;
    const result = await leaveService.getMyLeaves(userId, {
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
        status: 'success',
        data: result,
    });
});

// ── Get Leave by ID ─────────────────────────────────────────────────
export const getLeaveById = asyncHandler(async (req: Request, res: Response) => {
    const leave = await leaveService.getLeaveById(req.params.id);

    res.json({
        status: 'success',
        data: { leave },
    });
});

// ── Update Leave Status ─────────────────────────────────────────────
export const updateLeaveStatus = asyncHandler(async (req: Request, res: Response) => {
    const approvedBy = (req.user as any).id;
    const leave = await leaveService.updateLeaveStatus(req.params.id, req.body, approvedBy);

    res.json({
        status: 'success',
        data: { leave },
    });
});

// ── Get Leave Balance ───────────────────────────────────────────────
export const getLeaveBalance = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const balance = await leaveService.getLeaveBalance(userId, year);

    res.json({
        status: 'success',
        data: { balance },
    });
});
