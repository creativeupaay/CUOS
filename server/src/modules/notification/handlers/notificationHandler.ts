import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../../collaboration/types/types';
import { notificationService } from '../services/notification.service';
import { logger } from "../../../utils/logger";

/**
 * Setup notification-related socket event handlers
 */
export const setupNotificationHandlers = (socket: AuthenticatedSocket, io: Server) => {
    const userId = socket.data.userId;

    // Client requests initial unread count on connect
    socket.on('notification:getUnreadCount', async () => {
        try {
            const unreadCount = await notificationService.getUnreadCount(userId);
            socket.emit('notification:unreadCount', { unreadCount });
        } catch (error) {
            logger.error({ context: error }, '[NotificationHandler] Error getting unread count:');
        }
    });

    // Client marks a notification as read
    socket.on('notification:markRead', async (payload: { notificationId: string }) => {
        try {
            await notificationService.markAsRead(userId, [payload.notificationId]);
        } catch (error) {
            logger.error({ context: error }, '[NotificationHandler] Error marking read:');
        }
    });

    // Client marks all notifications as read
    socket.on('notification:markAllRead', async () => {
        try {
            await notificationService.markAsRead(userId);
        } catch (error) {
            logger.error({ context: error }, '[NotificationHandler] Error marking all read:');
        }
    });
};
