import api from '../../../services/api';
import type { INotification } from '../types';

interface NotificationsResponse {
    status: string;
    data: {
        notifications: INotification[];
        unreadCount: number;
    };
}

interface UnreadCountResponse {
    status: string;
    data: {
        unreadCount: number;
    };
}

interface SuccessResponse {
    status: string;
    message: string;
}

interface GetNotificationsParams {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
}

const notificationApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // Get notifications with optional filters
        getNotifications: builder.query<NotificationsResponse, GetNotificationsParams | void>({
            query: (params) => {
                const searchParams = new URLSearchParams();
                if (params?.limit) searchParams.append('limit', String(params.limit));
                if (params?.offset) searchParams.append('offset', String(params.offset));
                if (params?.unreadOnly) searchParams.append('unreadOnly', 'true');
                return `/notifications?${searchParams.toString()}`;
            },
            providesTags: ['Notifications'],
        }),

        // Get unread count only
        getUnreadCount: builder.query<UnreadCountResponse, void>({
            query: () => '/notifications/unread-count',
            providesTags: ['Notifications'],
        }),

        // Mark specific notifications as read
        markAsRead: builder.mutation<SuccessResponse, { notificationIds?: string[] }>({
            query: (body) => ({
                url: '/notifications/read',
                method: 'PATCH',
                body,
            }),
            invalidatesTags: ['Notifications'],
        }),

        // Mark all notifications as read
        markAllAsRead: builder.mutation<SuccessResponse, void>({
            query: () => ({
                url: '/notifications/read-all',
                method: 'PATCH',
            }),
            invalidatesTags: ['Notifications'],
        }),

        // Delete a single notification
        deleteNotification: builder.mutation<SuccessResponse, string>({
            query: (id) => ({
                url: `/notifications/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Notifications'],
        }),

        // Clear all notifications
        clearAllNotifications: builder.mutation<SuccessResponse, void>({
            query: () => ({
                url: '/notifications/clear-all',
                method: 'DELETE',
            }),
            invalidatesTags: ['Notifications'],
        }),
    }),
});

export const {
    useGetNotificationsQuery,
    useGetUnreadCountQuery,
    useMarkAsReadMutation,
    useMarkAllAsReadMutation,
    useDeleteNotificationMutation,
    useClearAllNotificationsMutation,
} = notificationApi;

export default notificationApi;
