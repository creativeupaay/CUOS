import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { announcementService } from '../services/announcement.service';
import { hasModuleAdminAccess } from '../../../utils/moduleAccess.util';

export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const announcement = await announcementService.createAnnouncement(req.body, userId);

    res.status(201).json({
        status: 'success',
        data: { announcement },
    });
});

export const getAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const isAdmin = req.user ? hasModuleAdminAccess(req.user, 'hrms') : false;
    const announcements = await announcementService.getAnnouncements(userId, isAdmin);

    res.json({
        status: 'success',
        data: { announcements },
    });
});

export const getUnreadAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const announcements = await announcementService.getUnreadAnnouncements(userId);

    res.json({
        status: 'success',
        data: { announcements },
    });
});

export const acknowledgeAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const announcementId = req.params.id;
    const result = await announcementService.acknowledgeAnnouncement(announcementId, userId);

    res.json({
        status: 'success',
        message: 'Announcement acknowledged',
        data: result,
    });
});

export const getAnnouncementReceipts = asyncHandler(async (req: Request, res: Response) => {
    const announcementId = req.params.id;
    const receipts = await announcementService.getAnnouncementReceipts(announcementId);

    res.json({
        status: 'success',
        data: { receipts },
    });
});

export const nudgeUnseen = asyncHandler(async (req: Request, res: Response) => {
    const announcementId = req.params.id;
    const senderUserId = req.user!.id;
    const result = await announcementService.nudgeUnseen(announcementId, senderUserId);

    res.json({
        status: 'success',
        message: `Reminded ${result.nudgedCount} pending team member(s)`,
        data: result,
    });
});

export const votePoll = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const announcementId = req.params.id;
    const { optionIds } = req.body;
    const result = await announcementService.votePoll(announcementId, optionIds, userId);

    res.json({
        status: 'success',
        message: 'Vote submitted successfully',
        data: result,
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

