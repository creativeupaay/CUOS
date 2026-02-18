import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { getProjectCostSummary } from '../services/projectCost.service';

export const getProjectCost = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const costSummary = await getProjectCostSummary(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Project cost summary retrieved successfully',
            data: costSummary,
        });
    }
);
