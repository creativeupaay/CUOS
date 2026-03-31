import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { INotification } from '../types';

interface NotificationState {
    isOpen: boolean;
    unreadCount: number;
    notifications: INotification[];
    browserPermission: NotificationPermission | 'default';
}

const initialState: NotificationState = {
    isOpen: false,
    unreadCount: 0,
    notifications: [],
    browserPermission: 'default',
};

const notificationSlice = createSlice({
    name: 'notification',
    initialState,
    reducers: {
        toggleNotificationPanel: (state) => {
            state.isOpen = !state.isOpen;
        },
        openNotificationPanel: (state) => {
            state.isOpen = true;
        },
        closeNotificationPanel: (state) => {
            state.isOpen = false;
        },
        setUnreadCount: (state, action: PayloadAction<number>) => {
            state.unreadCount = action.payload;
        },
        incrementUnreadCount: (state) => {
            state.unreadCount += 1;
        },
        addNotification: (state, action: PayloadAction<INotification>) => {
            // Add to the beginning of the list
            state.notifications.unshift(action.payload);
            // Increment unread count if notification is unread
            if (!action.payload.isRead) {
                state.unreadCount += 1;
            }
        },
        setNotifications: (state, action: PayloadAction<INotification[]>) => {
            state.notifications = action.payload;
        },
        markNotificationRead: (state, action: PayloadAction<string>) => {
            const notification = state.notifications.find((n) => n._id === action.payload);
            if (notification && !notification.isRead) {
                notification.isRead = true;
                state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
        },
        markAllNotificationsRead: (state) => {
            state.notifications.forEach((n) => {
                n.isRead = true;
            });
            state.unreadCount = 0;
        },
        removeNotification: (state, action: PayloadAction<string>) => {
            const index = state.notifications.findIndex((n) => n._id === action.payload);
            if (index !== -1) {
                if (!state.notifications[index].isRead) {
                    state.unreadCount = Math.max(0, state.unreadCount - 1);
                }
                state.notifications.splice(index, 1);
            }
        },
        clearAllNotifications: (state) => {
            state.notifications = [];
            state.unreadCount = 0;
        },
        setBrowserPermission: (state, action: PayloadAction<NotificationPermission>) => {
            state.browserPermission = action.payload;
        },
    },
});

export const {
    toggleNotificationPanel,
    openNotificationPanel,
    closeNotificationPanel,
    setUnreadCount,
    incrementUnreadCount,
    addNotification,
    setNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearAllNotifications,
    setBrowserPermission,
} = notificationSlice.actions;

export default notificationSlice.reducer;
