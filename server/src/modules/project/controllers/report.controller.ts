import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import * as reportService from '../services/report.service';

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
