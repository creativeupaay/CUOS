import { Server } from 'socket.io';
import { Types, FilterQuery } from 'mongoose';
import { logger } from '../../../utils/logger';
import { Notification, INotification, NotificationType } from '../models/Notification.model';
import { User } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import { Partner } from '../../partners/models/Partner.model';
import { PartnerEmployee } from '../../partners/models/PartnerEmployee.model';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';

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
    metadata?: Record<string, unknown>;
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
            logger.warn('[NotificationService] No superadmin roles found');
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
                await this.createBulkNotifications(filteredSuperadminIds, data);
            }
        } else {
            // For non-onboarding notifications, send to all superadmins
            await this.createBulkNotifications(superadminIds, data);
        }
    }

    /**
     * Send notification to all active internal users.
     * Excludes partner accounts and partner employees.
     */
    async notifyInternalUsers(data: Omit<CreateNotificationInput, 'userId'>): Promise<void> {
        const partnerRole = await Role.findOne({
            name: { $in: ['partner'] },
        }).select('_id');

        const partnerDocs = await Partner.find({
            userId: { $exists: true, $ne: null },
            isActive: true,
        }).select('userId').lean();

        const excludedPartnerUserIds = new Set(
            partnerDocs.map((partner) => partner.userId?.toString()).filter(Boolean)
        );

        const query: FilterQuery<INotification> = { isActive: true };
        if (partnerRole?._id) {
            query.role = { $ne: partnerRole._id };
        }

        const users = await User.find(query).select('_id').lean();
        const internalUserIds = users
            .map((user) => user._id as Types.ObjectId)
            .filter((userId) => !excludedPartnerUserIds.has(userId.toString()));

        if (internalUserIds.length === 0) {
            return;
        }

        await this.createBulkNotifications(internalUserIds, data);
    }

    /**
     * Get notifications for a user
     */
    async getNotifications(
        userId: string,
        options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
    ): Promise<{ notifications: INotification[]; unreadCount: number }> {
        const { limit = 50, offset = 0, unreadOnly = false } = options;

        const query: FilterQuery<INotification> = { userId: new Types.ObjectId(userId) };
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
        const query: FilterQuery<INotification> = { userId: new Types.ObjectId(userId) };
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
    async deleteNotifications(
        userId: string,
        notificationIds?: string[],
        options: ArchiveDeleteOptions = {}
    ): Promise<void> {
        const query: FilterQuery<INotification> = { userId: new Types.ObjectId(userId) };
        if (notificationIds?.length) {
            query._id = { $in: notificationIds.map((id) => new Types.ObjectId(id)) };
        }

        if (!options.skipArchive) {
            await DeletedRecordService.archiveAndDeleteMany(Notification, query, {
                archiveBatchId: options.archiveBatchId,
                deletedBy: options.deletedBy,
                reason: options.reason ?? 'User notification delete requested',
                operation: 'delete',
                session: options.session,
                metadata: {
                    userId,
                    notificationIds,
                    userTriggered: true,
                    archivePolicy: 'Explicit notification deletes are archived; automatic read-notification TTL purges are not archived.',
                    ...options.metadata,
                },
            });
        } else {
            await Notification.deleteMany(query, options.session ? { session: options.session } : undefined);
        }

        // Emit updated unread count
        const unreadCount = await this.getUnreadCount(userId);
        this.emitToUser(userId, 'notification:unreadCount', { unreadCount });
    }

    /**
     * Emit event to specific user's socket room
     */
    private emitToUser(userId: string, event: string, data: Record<string, unknown>): void {
        if (io) {
            io.to(`user:${userId}`).emit(event, data);
        }
    }
}

export const notificationService = new NotificationService();
