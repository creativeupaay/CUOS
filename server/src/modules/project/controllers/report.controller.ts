import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import * as reportService from '../services/report.service';
import * as aiReportService from '../services/aiReport.service';

export const getReportsDashboard = asyncHandler(
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

        const viewBy = (req.query.viewBy as string) || 'me';
        const startDateStr = req.query.startDate as string;
        const endDateStr = req.query.endDate as string;

        let targetUserId: string | undefined = userId;
        if (isAdmin) {
            if (viewBy === 'everyone') {
                targetUserId = undefined; // fetch for all users
            } else if (viewBy !== 'me') {
                targetUserId = viewBy;
            }
        }

        const data = await reportService.getDashboardReports({
            userId: targetUserId,
            startDate: startDateStr ? new Date(startDateStr) : undefined,
            endDate: endDateStr ? new Date(endDateStr) : undefined,
        });

        res.status(200).json({
            success: true,
            message: 'Reports retrieved successfully',
            data,
        });
    }
);

export const generateAiReport = asyncHandler(
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

        const { targetUserId: requestedUserId, startDate: startDateStr, endDate: endDateStr } = req.body;

        let targetUserId = userId;
        if (isAdmin && requestedUserId) {
            targetUserId = requestedUserId;
        }

        if (!targetUserId || targetUserId === 'everyone') {
            return res.status(400).json({
                success: false,
                message: 'AI Report can only be generated for an individual employee. Please select a specific team member.',
            });
        }

        const report = await aiReportService.generateEmployeeAiReport({
            targetUserId,
            startDate: startDateStr ? new Date(startDateStr) : undefined,
            endDate: endDateStr ? new Date(endDateStr) : undefined,
        });

        res.status(200).json({
            success: true,
            message: 'AI Report generated successfully',
            data: report,
        });
    }
);

