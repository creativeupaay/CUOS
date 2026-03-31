import { Bell } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { toggleNotificationPanel } from '../slices/notificationSlice';

export default function NotificationBell() {
    const dispatch = useAppDispatch();
    const unreadCount = useAppSelector((state) => state.notification.unreadCount);

    return (
        <button
            onClick={() => dispatch(toggleNotificationPanel())}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: 'var(--color-text-muted)' }}
            title="Notifications"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
            <Bell size={18} />
            {unreadCount > 0 && (
                <span
                    className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full"
                    style={{ backgroundColor: '#EF4444' }}
                >
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </button>
    );
}
