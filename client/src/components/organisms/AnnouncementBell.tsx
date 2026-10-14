import { useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import { useGetUnreadAnnouncementsQuery } from '@/features/hrms/hrmsApi';

export default function AnnouncementBell() {
    const navigate = useNavigate();
    const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
    const user = useAppSelector((state) => state.auth.user);
    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const isPartner = roleName === 'partner' || !!user?.isPartnerEmployee;

    const { data } = useGetUnreadAnnouncementsQuery(undefined, {
        skip: !isAuthenticated || isPartner,
        pollingInterval: 60000,
    });

    const unreadCount = data?.data?.announcements?.length || 0;

    if (!isAuthenticated || isPartner) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={() => navigate('/announcements', { state: { newTab: true } })}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: 'var(--color-text-muted)' }}
            title={unreadCount > 0 ? `${unreadCount} unread announcement(s)` : 'Company Announcements'}
            aria-label={`Company Announcements${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
            <Megaphone size={18} />
            {unreadCount > 0 && (
                <span
                    className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full animate-pulse shadow-sm"
                    style={{ backgroundColor: '#E11D48' }}
                >
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </button>
    );
}
