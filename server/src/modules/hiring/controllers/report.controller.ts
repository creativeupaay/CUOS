import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { HiringReportService } from '../services/report.service';
import type { HiringReportSummaryInput } from '../validators/report.validator';

const reportService = new HiringReportService();

export const getHiringReportSummary = asyncHandler(async (req: Request, res: Response) => {
    const { lastDays = 30 } = req.query as any as HiringReportSummaryInput;
    const report = await reportService.getSummary(lastDays);

    res.status(200).json({
        status: 'success',
        data: report,
    });
});
