import mongoose, { Document, Schema, Types } from 'mongoose';

export type NotificationType =
    | 'leave_submitted'
    | 'attendance_reminder'
    | 'employee_birthday'
    | 'employee_onboarding'
    | 'partner_onboarding'
    | 'client_onboarding'
    | 'holiday_declared'
    | 'company_announcement'
    | 'task_assigned'
    | 'leave_status_updated'
    | 'credential_access_granted'
    | 'document_access_granted'
    | 'note_mentioned';

export interface INotification extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            required: true,
            enum: [
                'leave_submitted',
                'attendance_reminder',
                'employee_birthday',
                'employee_onboarding',
                'partner_onboarding',
                'client_onboarding',
                'holiday_declared',
                'company_announcement',
                'task_assigned',
                'leave_status_updated',
                'credential_access_granted',
                'document_access_granted',
                'note_mentioned',
            ],
            index: true,
        },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        link: { type: String, trim: true },
        isRead: { type: Boolean, default: false, index: true },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// Auto-delete old read notifications after 30 days (TTL index)
NotificationSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { isRead: true } }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
