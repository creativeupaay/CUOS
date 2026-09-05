import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { User } from '../../auth/models/User.model';
import { hasModuleAdminAccess, hasModuleViewAccess } from '../../../utils/moduleAccess.util';

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

    await notificationService.deleteNotifications(userId, [id], {
        deletedBy: userId,
        reason: 'Notification delete requested',
    });

    res.json({
        success: true,
        message: 'Notification deleted',
    });
});

// Clear all notifications
export const clearAllNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    await notificationService.deleteNotifications(userId, undefined, {
        deletedBy: userId,
        reason: 'Notification clear-all requested',
        metadata: {
            clearAll: true,
        },
    });

    res.json({
        success: true,
        message: 'All notifications cleared',
    });
});

// Ping a user — admin sends an alert notification with sound to a specific employee
export const pingUser = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError('Not authenticated', 401);

    // Admins with projectManagement access OR HR admins can ping
    const isPmAdmin = hasModuleAdminAccess(req.user, 'projectManagement');
    const isHrAdmin = hasModuleAdminAccess(req.user, 'hrms') || hasModuleViewAccess(req.user, 'hrms');
    if (!isPmAdmin && !isHrAdmin) {
        throw new AppError('Admin access required to ping users', 403);
    }

    const { targetUserId, pingType } = req.body as {
        targetUserId: string;
        pingType: 'todo' | 'timer';
    };

    if (!targetUserId || !pingType) {
        throw new AppError('targetUserId and pingType are required', 400);
    }

    // Validate target user exists
    const targetUser = await User.findById(targetUserId).select('name').lean();
    if (!targetUser) {
        throw new AppError('Target user not found', 404);
    }

    const adminUser = await User.findById(adminId).select('name').lean();
    const fullAdminName = (adminUser as any)?.name || 'Admin';
    const adminName = fullAdminName.trim().split(/[\s-]/)[0];

    const pingMessages: Record<string, { title: string; message: string }> = {
        todo: {
            title: '📋 Please add your daily tasks!',
            message: `${adminName} is asking you to add your daily to-do tasks. Please update your tasks for today.`,
        },
        timer: {
            title: '⏱️ Don\'t forget to start your timer!',
            message: `${adminName} noticed your timer is not running. Please resume your day timer.`,
        },
    };

    const { title, message } = pingMessages[pingType];

    // Create a persistent notification for the user
    await notificationService.createNotification({
        userId: targetUserId,
        type: 'admin_ping',
        title,
        message,
        metadata: { pingType, adminId, adminName },
    });

    // Also emit a high-priority socket event for immediate audio + toast on the client
    const { getSocketIO } = await import('../services/notification.service');
    const socketIO = getSocketIO();
    if (socketIO) {
        socketIO.to(`user:${targetUserId}`).emit('ping:received', {
            pingType,
            title,
            message,
            adminName,
        });
    }

    res.json({
        success: true,
        message: `Ping sent to user successfully`,
    });
});

// Broadcast a break notification — any authenticated employee can call this.
// Only 'other' breaks emit a notification to all internal users.
export const broadcastBreak = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    const { breakType, reason } = req.body as {
        breakType: 'lunch' | 'tea' | 'other';
        reason?: string;
    };

    if (!breakType || !['lunch', 'tea', 'other'].includes(breakType)) {
        throw new AppError('breakType must be one of: lunch, tea, other', 400);
    }

    if (breakType === 'other') {
        if (!reason?.trim()) {
            throw new AppError('A reason is required for "other" breaks', 400);
        }

        const userRecord = await User.findById(userId).select('name').lean();
        const userName = (userRecord as any)?.name || 'Someone';
        const firstName = userName.trim().split(/[\s-]/)[0];

        await notificationService.notifyInternalUsers({
            type: 'break_started',
            title: `🛑 ${firstName} is on a break`,
            message: `${userName} stepped away: ${reason.trim()}`,
            metadata: { breakType, reason: reason.trim(), userId },
        });
    }

    res.json({
        success: true,
        message: 'Break logged successfully',
        data: { breakType },
    });
});
