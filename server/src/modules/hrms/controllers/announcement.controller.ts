import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { announcementService } from '../services/announcement.service';

export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const announcement = await announcementService.createAnnouncement(req.body, userId);

    res.status(201).json({
        status: 'success',
        data: { announcement },
    });
});

export const getAnnouncements = asyncHandler(async (_req: Request, res: Response) => {
    const announcements = await announcementService.getAnnouncements();

    res.json({
        status: 'success',
        data: { announcements },
    });
});

export const deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    await announcementService.deleteAnnouncement(req.params.id, {
        deletedBy: req.user?.id,
        reason: 'HRMS announcement delete requested',
    });

    res.json({
        status: 'success',
        message: 'Announcement deleted successfully',
    });
});
