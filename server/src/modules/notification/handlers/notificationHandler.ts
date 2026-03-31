import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../../collaboration/types/types';
import { notificationService } from '../services/notification.service';

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
            console.error('[NotificationHandler] Error getting unread count:', error);
        }
    });

    // Client marks a notification as read
    socket.on('notification:markRead', async (payload: { notificationId: string }) => {
        try {
            await notificationService.markAsRead(userId, [payload.notificationId]);
        } catch (error) {
            console.error('[NotificationHandler] Error marking read:', error);
        }
    });

    // Client marks all notifications as read
    socket.on('notification:markAllRead', async () => {
        try {
            await notificationService.markAsRead(userId);
        } catch (error) {
            console.error('[NotificationHandler] Error marking all read:', error);
        }
    });
};
