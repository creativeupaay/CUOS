import { Request, Response } from 'express';
import * as orgSettingsService from '../services/org-settings.service';
import * as dashboardService from '../services/dashboard.service';
import asyncHandler from '../../../utils/asyncHandler';

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
    const settings = await orgSettingsService.getSettings();

    res.json({
        success: true,
        message: 'Settings retrieved successfully',
        data: settings,
    });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const settings = await orgSettingsService.updateSettings(req.body, req.user!.id);

    res.json({
        success: true,
        message: 'Settings updated successfully',
        data: settings,
    });
});

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await dashboardService.getDashboardStats();

    res.json({
        success: true,
        message: 'Dashboard stats retrieved successfully',
        data: stats,
    });
});
