import { useEffect, useCallback, useRef } from 'react';
import { logger } from '@/utils/logger';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { socket, connectSocket } from '@/services/socket';
import {
    addNotification,
    setUnreadCount,
    setBrowserPermission,
} from '../slices/notificationSlice';
import type { INotification } from '../types';
import { playNotificationSound } from '../utils/sound';

/**
 * Universal helper to trigger single CUOS native OS push notification
 */
export function sendDesktopPushNotification(
    title: string,
    message: string,
    options: { link?: string; tag?: string; icon?: string; forceNative?: boolean } = {}
) {
    if (typeof window === 'undefined' || !title) return;

    logger.info('[DesktopPushNotification] Triggering native OS push notification:', { title, message });

    // 1. Play audio chime
    try {
        playNotificationSound();
    } catch {
        // Ignore audio error
    }

    const iconUrl = options.icon || `${window.location.origin}/company-logo2.png`;
    const notificationTag = options.tag || `cuos-notif-${title.slice(0, 15)}`;

    // 2. Dispatch SINGLE Native Browser OS Notification
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const notification = new Notification(title, {
                body: message,
                icon: iconUrl,
                tag: notificationTag,
                requireInteraction: true,
            });

            notification.onclick = () => {
                try {
                    window.focus();
                } catch {
                    // Ignore focus error
                }
                if (options.link) {
                    window.location.href = options.link;
                }
                notification.close();
            };
        } catch (err) {
            logger.error('[DesktopPushNotification] Direct Notification error:', err);
        }
    } else if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((p) => {
            if (p === 'granted') {
                sendDesktopPushNotification(title, message, options);
            }
        });
    }
}

/**
 * Hook to handle notification socket events and browser push notifications
 */
export const useNotificationSocket = () => {
    const dispatch = useAppDispatch();
    const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
    const soundEnabled = useAppSelector((state) => state.notification.soundEnabled);

    const soundEnabledRef = useRef(soundEnabled);
    useEffect(() => {
        soundEnabledRef.current = soundEnabled;
    }, [soundEnabled]);

    // Request browser notification permission
    const requestBrowserPermission = useCallback(async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return;
        }

        const currentPermission = Notification.permission;
        dispatch(setBrowserPermission(currentPermission));

        if (currentPermission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                dispatch(setBrowserPermission(permission));
            } catch (error) {
                logger.error('[NotificationSocket] Error requesting browser notification permission:', error);
            }
        }
    }, [dispatch]);

    // Show native desktop push notification outside the browser
    const showBrowserNotification = useCallback((notification: INotification) => {
        if (!notification || !notification.title) return;
        sendDesktopPushNotification(notification.title, notification.message, {
            link: notification.link,
            tag: notification._id,
        });
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;

        // Ensure socket is connected
        connectSocket();

        // Request browser push notification permission
        requestBrowserPermission();

        // Request initial unread count on connect
        const handleConnect = () => {
            socket.emit('notification:getUnreadCount');
        };

        // Handle new notifications (defensively handle both { notification } wrapper and raw notification object)
        const handleNewNotification = (data: any) => {
            logger.info('[NotificationSocket] Received socket event notification:new', data);
            
            const notification: INotification = data?.notification || data;

            if (!notification || !notification.title) {
                logger.warn('[NotificationSocket] Received invalid notification payload:', data);
                return;
            }

            dispatch(addNotification(notification));

            // Trigger single desktop push notification outside browser
            showBrowserNotification(notification);
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

        // Handle admin ping — plays alert sound and shows a loud, persistent toast
        const handlePingReceived = (data: { pingType: 'todo' | 'timer'; title: string; message: string; adminName: string }) => {
            logger.info('[NotificationSocket] Admin ping received:', data);

            // Play notification sound immediately (repeated for extra urgency)
            try {
                playNotificationSound(1.0);
                setTimeout(() => {
                    try { playNotificationSound(0.8); } catch { /* ignore */ }
                }, 700);
            } catch { /* ignore */ }

            // Show native OS desktop notification
            sendDesktopPushNotification(data.title, data.message, { tag: 'admin-ping' });

            // Show an in-app toast (lasts 20 seconds)
            import('react-hot-toast').then((m) => {
                m.default.dismiss('admin-ping');
                m.default(data.title + '\n' + data.message, {
                    id: 'admin-ping',
                    duration: 5000,
                    position: 'top-center',
                    icon: data.pingType === 'todo' ? '📋' : '⏱️',
                    style: {
                        maxWidth: '420px',
                        fontWeight: '600',
                        background: data.pingType === 'todo' ? '#FEF3C7' : '#DBEAFE',
                        color: data.pingType === 'todo' ? '#92400E' : '#1E3A8A',
                        border: `2px solid ${data.pingType === 'todo' ? '#F59E0B' : '#3B82F6'}`,
                        whiteSpace: 'pre-line',
                        borderRadius: '12px',
                        padding: '14px 18px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                    },
                });
            }).catch(() => {});
        };

        socket.on('ping:received', handlePingReceived);


        return () => {
            socket.off('connect', handleConnect);
            socket.off('notification:new', handleNewNotification);
            socket.off('notification:unreadCount', handleUnreadCount);
            socket.off('ping:received', handlePingReceived);
        };
    }, [isAuthenticated, dispatch, requestBrowserPermission, showBrowserNotification]);
};