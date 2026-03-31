import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import asyncHandler from '../../../utils/asyncHandler';

// Get notifications with pagination
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { limit, offset, unreadOnly } = req.query;

    const result = await notificationService.getNotifications(userId, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        unreadOnly: unreadOnly === 'true',
    });

    res.json({
        status: 'success',
        data: result,
    });
});

// Get unread count
export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const unreadCount = await notificationService.getUnreadCount(userId);

    res.json({
        status: 'success',
        data: { unreadCount },
    });
});

// Mark specific notifications as read
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { notificationIds } = req.body;

    await notificationService.markAsRead(userId, notificationIds);

    res.json({
        status: 'success',
        message: 'Notifications marked as read',
    });
});

// Mark all notifications as read
export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;

    await notificationService.markAsRead(userId);

    res.json({
        status: 'success',
        message: 'All notifications marked as read',
    });
});

// Delete a single notification
export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { id } = req.params;

    await notificationService.deleteNotifications(userId, [id]);

    res.json({
        status: 'success',
        message: 'Notification deleted',
    });
});

// Clear all notifications
export const clearAllNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;

    await notificationService.deleteNotifications(userId);

    res.json({
        status: 'success',
        message: 'All notifications cleared',
    });
});
