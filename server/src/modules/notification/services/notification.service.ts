import { Server } from 'socket.io';
import { Types } from 'mongoose';
import { Notification, INotification, NotificationType } from '../models/Notification.model';
import { User } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import { Partner } from '../../partners/models/Partner.model';
import { PartnerEmployee } from '../../partners/models/PartnerEmployee.model';

// Global socket.io reference - set from socket.config.ts
let io: Server | null = null;

export const setSocketIO = (socketIO: Server) => {
    io = socketIO;
};

export const getSocketIO = (): Server | null => io;

interface CreateNotificationInput {
    userId: string | Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, any>;
}

class NotificationService {
    /**
     * Create a notification and emit via Socket.io
     */
    async createNotification(data: CreateNotificationInput): Promise<INotification> {
        const notification = await Notification.create({
            ...data,
            userId: new Types.ObjectId(data.userId.toString()),
        });

        // Emit real-time notification to user's room
        this.emitToUser(data.userId.toString(), 'notification:new', {
            notification: notification.toObject(),
        });

        return notification;
    }

    /**
     * Create notifications for multiple users (bulk)
     */
    async createBulkNotifications(
        userIds: (string | Types.ObjectId)[],
        data: Omit<CreateNotificationInput, 'userId'>
    ): Promise<void> {
        if (userIds.length === 0) return;

        const notifications = userIds.map((userId) => ({
            ...data,
            userId: new Types.ObjectId(userId.toString()),
        }));

        const created = await Notification.insertMany(notifications);

        // Emit to each user
        created.forEach((notification, index) => {
            this.emitToUser(userIds[index].toString(), 'notification:new', {
                notification: notification.toObject(),
            });
        });
    }

    /**
     * Send notification to all superadmins (excluding partners and partner employees)
     */
    async notifySuperadmins(data: Omit<CreateNotificationInput, 'userId'>): Promise<void> {
        // Find superadmin role(s)
        const superadminRoles = await Role.find({
            name: { $in: ['super-admin', 'super_admin', 'superadmin'] },
        }).select('_id');

        if (superadminRoles.length === 0) {
            console.warn('[NotificationService] No superadmin roles found');
            return;
        }

        const roleIds = superadminRoles.map((r) => r._id);

        // Find active users with superadmin roles
        const superadmins = await User.find({
            role: { $in: roleIds },
            isActive: true,
        }).select('_id');

        if (superadmins.length === 0) {
            return;
        }

        const superadminIds = superadmins.map((u) => u._id as Types.ObjectId);

        // Exclude partners and partner employees from onboarding notifications
        const onboardingTypes = ['partner_onboarding', 'client_onboarding', 'employee_onboarding'];
        if (onboardingTypes.includes(data.type)) {
            // Get all partner user IDs (partners who have completed onboarding)
            const partners = await Partner.find({
                userId: { $exists: true, $ne: null },
                isActive: true,
            }).select('userId').lean();

            const partnerUserIds = partners.map(p => p.userId!.toString());

            // Get all partner employee IDs (partner employees are users themselves)
            const partnerEmployees = await PartnerEmployee.find({
                isActive: true,
            }).select('_id').lean();

            const partnerEmployeeIds = partnerEmployees.map(pe => pe._id.toString());

            // Filter out partners and partner employees from superadmin list
            const filteredSuperadminIds = superadminIds.filter(id => {
                const idStr = id.toString();
                return !partnerUserIds.includes(idStr) && !partnerEmployeeIds.includes(idStr);
            });

            if (filteredSuperadminIds.length > 0) {
                await this.createBulkNotifications(filteredSuperadminIds as any, data);
            }
        } else {
            // For non-onboarding notifications, send to all superadmins
            const superadminIdsFixed = superadminIds.map((u) => u as any);
            await this.createBulkNotifications(superadminIdsFixed, data);
        }
    }

    /**
     * Get notifications for a user
     */
    async getNotifications(
        userId: string,
        options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
    ): Promise<{ notifications: INotification[]; unreadCount: number }> {
        const { limit = 50, offset = 0, unreadOnly = false } = options;

        const query: any = { userId: new Types.ObjectId(userId) };
        if (unreadOnly) query.isRead = false;

        const [notifications, unreadCount] = await Promise.all([
            Notification.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
            Notification.countDocuments({
                userId: new Types.ObjectId(userId),
                isRead: false,
            }),
        ]);

        return { notifications: notifications as INotification[], unreadCount };
    }

    /**
     * Get unread count for a user
     */
    async getUnreadCount(userId: string): Promise<number> {
        return Notification.countDocuments({
            userId: new Types.ObjectId(userId),
            isRead: false,
        });
    }

    /**
     * Mark notification(s) as read
     */
    async markAsRead(userId: string, notificationIds?: string[]): Promise<void> {
        const query: any = { userId: new Types.ObjectId(userId) };
        if (notificationIds?.length) {
            query._id = { $in: notificationIds.map((id) => new Types.ObjectId(id)) };
        }

        await Notification.updateMany(query, { $set: { isRead: true } });

        // Emit updated unread count
        const unreadCount = await this.getUnreadCount(userId);
        this.emitToUser(userId, 'notification:unreadCount', { unreadCount });
    }

    /**
     * Delete notification(s)
     */
    async deleteNotifications(userId: string, notificationIds?: string[]): Promise<void> {
        const query: any = { userId: new Types.ObjectId(userId) };
        if (notificationIds?.length) {
            query._id = { $in: notificationIds.map((id) => new Types.ObjectId(id)) };
        }

        await Notification.deleteMany(query);

        // Emit updated unread count
        const unreadCount = await this.getUnreadCount(userId);
        this.emitToUser(userId, 'notification:unreadCount', { unreadCount });
    }

    /**
     * Emit event to specific user's socket room
     */
    private emitToUser(userId: string, event: string, data: any): void {
        if (io) {
            io.to(`user:${userId}`).emit(event, data);
        }
    }
}

export const notificationService = new NotificationService();
