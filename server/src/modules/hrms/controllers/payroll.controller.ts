import { Request, Response, NextFunction } from 'express';
import { payrollService } from '../services/payroll.service';
import { analyticsService } from '../services/analytics.service';
import asyncHandler from '../../../utils/asyncHandler';

// ── Generate Payroll ────────────────────────────────────────────────
export const generatePayroll = asyncHandler(async (req: Request, res: Response) => {
    const generatedBy = (req.user as any).id;
    const { employeeId, month, year } = req.body;
    const payroll = await payrollService.generatePayroll(employeeId, month, year, generatedBy);

    res.status(201).json({
        status: 'success',
        data: { payroll },
    });
});

// ── Get All Payrolls ────────────────────────────────────────────────
export const getPayrolls = asyncHandler(async (req: Request, res: Response) => {
    const { month, year, status, page, limit } = req.query;
    const result = await payrollService.getPayrolls({
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
        status: 'success',
        data: result,
    });
});

// ── Get Payroll by ID ───────────────────────────────────────────────
export const getPayrollById = asyncHandler(async (req: Request, res: Response) => {
    const payroll = await payrollService.getPayrollById(req.params.id);

    res.json({
        status: 'success',
        data: { payroll },
    });
});

// ── Update Payroll Status ───────────────────────────────────────────
export const updatePayrollStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const payroll = await payrollService.updatePayrollStatus(req.params.id, req.body.status, userId);

    res.json({
        status: 'success',
        data: { payroll },
    });
});

// ── Dashboard Stats ─────────────────────────────────────────────────
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getDashboardStats();

    res.json({
        status: 'success',
        data: stats,
    });
});

// ── Working Hours Analytics ─────────────────────────────────────────
export const getWorkingHoursAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string || (req.user as any).id;
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);

    const analytics = await analyticsService.getWorkingHoursAnalytics(userId, startDate, endDate);

    res.json({
        status: 'success',
        data: analytics,
    });
});

// ── Team Analytics ──────────────────────────────────────────────────
export const getTeamAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const managerId = req.params.managerId;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const analytics = await analyticsService.getTeamAnalytics(managerId, month, year);

    res.json({
        status: 'success',
        data: { team: analytics },
    });
});

// ── Incentive Summary ───────────────────────────────────────────────
export const getIncentiveSummary = asyncHandler(async (req: Request, res: Response) => {
    const { employeeId } = req.params;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const summary = await analyticsService.getIncentiveSummary(employeeId, month, year);

    res.json({
        status: 'success',
        data: summary,
    });
});
