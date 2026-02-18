import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAuditLog extends Document {
    userId: Types.ObjectId;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        action: {
            type: String,
            required: true,
            enum: [
                'user_created',
                'user_updated',
                'user_deactivated',
                'user_activated',
                'password_reset',
                'role_created',
                'role_updated',
                'role_deleted',
                'role_cloned',
                'permission_created',
                'permission_deleted',
                'permission_changed',
                'settings_updated',
                'login',
                'logout',
            ],
        },
        resource: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        resourceId: {
            type: String,
            trim: true,
        },
        details: {
            type: Schema.Types.Mixed,
        },
        ipAddress: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient querying
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
