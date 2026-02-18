import { Request, Response } from 'express';
import * as auditService from '../services/audit.service';
import asyncHandler from '../../../utils/asyncHandler';

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
        userId: req.query.userId as string,
        action: req.query.action as string,
        resource: req.query.resource as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 30,
    };

    const result = await auditService.getAuditLogs(filters);

    res.json({
        success: true,
        message: 'Audit logs retrieved successfully',
        data: result,
    });
});
