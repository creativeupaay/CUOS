import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import * as reimbursementService from '../services/reimbursement.service';
import type { CreateReimbursementInput, UpdateReimbursementInput, UpdateReimbursementStatusInput } from '../validators/reimbursement.validator';

// ── Create draft ──────────────────────────────────────────────────────
export const createReimbursement = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const data = req.body as CreateReimbursementInput;

    const reimbursement = await reimbursementService.createReimbursement(userId, data);

    res.status(201).json({
        status: 'success',
        data: { reimbursement },
    });
});

// ── Upload receipt ────────────────────────────────────────────────────
export const uploadReceipt = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!req.file) {
        throw new AppError('No file uploaded', 400);
    }

    const reimbursement = await reimbursementService.uploadReceipt(userId, id, req.file);

    res.status(200).json({
        status: 'success',
        data: { reimbursement },
    });
});

// ── Submit draft ──────────────────────────────────────────────────────
export const submitReimbursement = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const reimbursement = await reimbursementService.submitReimbursement(userId, id);

    res.status(200).json({
        status: 'success',
        message: 'Reimbursement submitted for approval',
        data: { reimbursement },
    });
});

// ── Update draft / changes_requested (employee) ───────────────────────
export const updateReimbursement = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;
    const data = req.body as UpdateReimbursementInput;

    const reimbursement = await reimbursementService.updateReimbursement(userId, id, data);

    res.status(200).json({
        status: 'success',
        data: { reimbursement },
    });
});

// ── Get my reimbursements (employee) ─────────────────────────────────
export const getMyReimbursements = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { status, category, startDate, endDate, policy, sort, page, limit } = req.query;

    const result = await reimbursementService.getMyReimbursements(userId, {
        status: status as string,
        category: category as string,
        startDate: startDate as string,
        endDate: endDate as string,
        policy: policy as string,
        sort: sort as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

// ── Get my summary (employee) ─────────────────────────────────────────
export const getMyReimbursementSummary = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const summary = await reimbursementService.getMyReimbursementSummary(userId);

    res.status(200).json({
        status: 'success',
        data: { summary },
    });
});

// ── Get all reimbursements (admin) ────────────────────────────────────
export const getReimbursements = asyncHandler(async (req: Request, res: Response) => {
    const { status, category, department, search, startDate, endDate, policy, sort, page, limit } = req.query;

    const result = await reimbursementService.getReimbursements({
        status: status as string,
        category: category as string,
        department: department as string,
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
        policy: policy as string,
        sort: sort as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

// ── Get org-wide summary (admin) ──────────────────────────────────────
export const getReimbursementSummary = asyncHandler(async (_req: Request, res: Response) => {
    const summary = await reimbursementService.getReimbursementSummary();

    res.status(200).json({
        status: 'success',
        data: { summary },
    });
});

// ── Get single reimbursement ──────────────────────────────────────────
export const getReimbursementById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;
    const isAdmin = req.isHrmsAdmin === true;

    const reimbursement = await reimbursementService.getReimbursementById(userId, id, isAdmin);

    res.status(200).json({
        status: 'success',
        data: { reimbursement },
    });
});

// ── Admin: update status ──────────────────────────────────────────────
export const updateReimbursementStatus = asyncHandler(async (req: Request, res: Response) => {
    const adminUserId = req.user!.id;
    const adminName = (req.user as any)?.name || 'Admin';
    const { id } = req.params;
    const data = req.body as UpdateReimbursementStatusInput;

    const { reimbursement } = await reimbursementService.updateReimbursementStatus(
        adminUserId,
        adminName,
        id,
        data
    );

    res.status(200).json({
        status: 'success',
        data: { reimbursement },
    });
});

// ── Delete draft ──────────────────────────────────────────────────────
export const deleteReimbursement = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;
    const isAdmin = req.isHrmsAdmin === true;

    await reimbursementService.deleteReimbursement(userId, id, isAdmin);

    res.status(200).json({
        status: 'success',
        message: 'Reimbursement deleted',
        data: null,
    });
});
