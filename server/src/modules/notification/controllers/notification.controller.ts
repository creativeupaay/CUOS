import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';

const requireUserId = (req: Request): string => {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401);
    return userId;
};

// Get notifications with pagination
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { limit, offset, unreadOnly } = req.query;

    const result = await notificationService.getNotifications(userId, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        unreadOnly: unreadOnly === 'true',
    });

    res.json({
        success: true,
        message: 'Notifications retrieved',
        data: result,
    });
});

// Get unread count
export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const unreadCount = await notificationService.getUnreadCount(userId);

    res.json({
        success: true,
        message: 'Unread count retrieved',
        data: { unreadCount },
    });
});

// Mark specific notifications as read
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { notificationIds } = req.body;

    await notificationService.markAsRead(userId, notificationIds);

    res.json({
        success: true,
        message: 'Notifications marked as read',
    });
});

// Mark all notifications as read
export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    await notificationService.markAsRead(userId);

    res.json({
        success: true,
        message: 'All notifications marked as read',
    });
});

// Delete a single notification
export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { id } = req.params;

    await notificationService.deleteNotifications(userId, [id]);

    res.json({
        success: true,
        message: 'Notification deleted',
    });
});

// Clear all notifications
export const clearAllNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    await notificationService.deleteNotifications(userId);

    res.json({
        success: true,
        message: 'All notifications cleared',
    });
});
