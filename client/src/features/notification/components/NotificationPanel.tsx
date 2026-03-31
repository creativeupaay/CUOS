import { useEffect, useRef } from 'react';
import { X, Trash2, CheckCheck, Bell } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { useNavigate } from 'react-router-dom';
import {
    closeNotificationPanel,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearAllNotifications as clearAllAction,
    setNotifications,
    setUnreadCount,
} from '../slices/notificationSlice';
import {
    useGetNotificationsQuery,
    useMarkAsReadMutation,
    useMarkAllAsReadMutation,
    useDeleteNotificationMutation,
    useClearAllNotificationsMutation,
} from '../api/notificationApi';
import type { INotification } from '../types';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationPanel() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const panelRef = useRef<HTMLDivElement>(null);

    const isOpen = useAppSelector((state) => state.notification.isOpen);
    const notifications = useAppSelector((state) => state.notification.notifications);

    const { data, isLoading } = useGetNotificationsQuery(undefined, { skip: !isOpen });
    const [markAsRead] = useMarkAsReadMutation();
    const [markAllAsRead] = useMarkAllAsReadMutation();
    const [deleteNotification] = useDeleteNotificationMutation();
    const [clearAll] = useClearAllNotificationsMutation();

    // Sync API data with local state
    useEffect(() => {
        if (data?.data) {
            dispatch(setNotifications(data.data.notifications));
            dispatch(setUnreadCount(data.data.unreadCount));
        }
    }, [data, dispatch]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                dispatch(closeNotificationPanel());
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, dispatch]);

    // Escape key to close
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                dispatch(closeNotificationPanel());
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, dispatch]);

    const handleNotificationClick = async (notification: INotification) => {
        if (!notification.isRead) {
            dispatch(markNotificationRead(notification._id));
            await markAsRead({ notificationIds: [notification._id] });
        }

        if (notification.link) {
            navigate(notification.link);
            dispatch(closeNotificationPanel());
        }
    };

    const handleMarkAllRead = async () => {
        dispatch(markAllNotificationsRead());
        await markAllAsRead();
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        dispatch(removeNotification(id));
        await deleteNotification(id);
    };

    const handleClearAll = async () => {
        dispatch(clearAllAction());
        await clearAll();
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" />

            {/* Panel */}
            <div
                ref={panelRef}
                className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col animate-slide-in-right"
                style={{ borderLeft: '1px solid var(--color-border-default)' }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3.5 shrink-0"
                    style={{ borderBottom: '1px solid var(--color-border-default)' }}
                >
                    <div className="flex items-center gap-2">
                        <Bell size={18} style={{ color: 'var(--color-text-primary)' }} />
                        <h2
                            className="text-base font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Notifications
                        </h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {notifications.length > 0 && (
                            <>
                                <button
                                    onClick={handleMarkAllRead}
                                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-gray-100 transition-colors"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    title="Mark all as read"
                                >
                                    <CheckCheck size={14} />
                                    <span className="hidden sm:inline">Read all</span>
                                </button>
                                <button
                                    onClick={handleClearAll}
                                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-gray-100 transition-colors"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    title="Clear all"
                                >
                                    <Trash2 size={14} />
                                    <span className="hidden sm:inline">Clear all</span>
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => dispatch(closeNotificationPanel())}
                            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors ml-1"
                            style={{ color: 'var(--color-text-muted)' }}
                            title="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="w-6 h-6 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                            >
                                <CheckCheck size={28} className="text-gray-300" />
                            </div>
                            <p
                                className="text-sm font-medium mb-1"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                All caught up!
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                No new notifications
                            </p>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification._id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`
                                    relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors group
                                    hover:bg-gray-50
                                    ${!notification.isRead ? 'bg-emerald-50/40' : ''}
                                `}
                                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                            >
                                {/* Unread indicator */}
                                {!notification.isRead && (
                                    <div
                                        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                                        style={{ backgroundColor: 'var(--color-primary)' }}
                                    />
                                )}

                                <div className="flex-1 min-w-0 pl-2">
                                    <h4
                                        className={`text-sm truncate ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}
                                        style={{ color: 'var(--color-text-primary)' }}
                                    >
                                        {notification.title}
                                    </h4>
                                    <p
                                        className="mt-0.5 text-xs line-clamp-2"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        {notification.message}
                                    </p>
                                    <p
                                        className="mt-1.5 text-[10px]"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        {formatDistanceToNow(new Date(notification.createdAt), {
                                            addSuffix: true,
                                        })}
                                    </p>
                                </div>

                                {/* Delete button */}
                                <button
                                    onClick={(e) => handleDelete(e, notification._id)}
                                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all shrink-0"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    title="Delete notification"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style>{`
                @keyframes slide-in-right {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.25s ease-out;
                }
            `}</style>
        </>
    );
}
