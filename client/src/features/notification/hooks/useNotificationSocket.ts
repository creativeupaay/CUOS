import { useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { socket, connectSocket } from '@/services/socket';
import {
    addNotification,
    setUnreadCount,
    setBrowserPermission,
} from '../slices/notificationSlice';
import type { INotification } from '../types';

/**
 * Hook to handle notification socket events and browser notification permission
 */
export const useNotificationSocket = () => {
    const dispatch = useAppDispatch();
    const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
    const browserPermission = useAppSelector((state) => state.notification.browserPermission);

    // Request browser notification permission
    const requestBrowserPermission = useCallback(async () => {
        if (!('Notification' in window)) {
            return;
        }

        const currentPermission = Notification.permission;
        dispatch(setBrowserPermission(currentPermission));

        if (currentPermission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                dispatch(setBrowserPermission(permission));
            } catch (error) {
                logger.error('[NotificationSocket] Error requesting permission:', error);
            }
        }
    }, [dispatch]);

    // Show browser notification
    const showBrowserNotification = useCallback(
        (notification: INotification) => {
            if (browserPermission !== 'granted') return;
            if (document.hasFocus()) return; // Don't show if tab is focused

            try {
                const browserNotification = new Notification(notification.title, {
                    body: notification.message,
                    icon: '/favicon.ico',
                    tag: notification._id,
                });

                browserNotification.onclick = () => {
                    window.focus();
                    if (notification.link) {
                        window.location.href = notification.link;
                    }
                    browserNotification.close();
                };

                // Auto close after 5 seconds
                setTimeout(() => browserNotification.close(), 5000);
            } catch (error) {
                logger.error('[NotificationSocket] Error showing browser notification:', error);
            }
        },
        [browserPermission]
    );

    useEffect(() => {
        if (!isAuthenticated) return;

        // Ensure socket is connected
        connectSocket();

        // Request browser notification permission
        requestBrowserPermission();

        // Request initial unread count on connect
        const handleConnect = () => {
            socket.emit('notification:getUnreadCount');
        };

        // Handle new notifications
        const handleNewNotification = (data: { notification: INotification }) => {
            dispatch(addNotification(data.notification));
            showBrowserNotification(data.notification);
        };

        // Handle unread count updates
        const handleUnreadCount = (data: { unreadCount: number }) => {
            dispatch(setUnreadCount(data.unreadCount));
        };

        // If already connected, request unread count
        if (socket.connected) {
            socket.emit('notification:getUnreadCount');
        }

        socket.on('connect', handleConnect);
        socket.on('notification:new', handleNewNotification);
        socket.on('notification:unreadCount', handleUnreadCount);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('notification:new', handleNewNotification);
            socket.off('notification:unreadCount', handleUnreadCount);
        };
    }, [isAuthenticated, dispatch, requestBrowserPermission, showBrowserNotification]);
};
