import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission extends Document {
    resource: string;
    action: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
}

const PermissionSchema = new Schema<IPermission>(
    {
        resource: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        action: {
            type: String,
            required: true,
            enum: ['create', 'read', 'update', 'delete', 'manage'],
            lowercase: true,
        },
        description: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index to prevent duplicate permissions
PermissionSchema.index({ resource: 1, action: 1 }, { unique: true });

export const Permission = mongoose.model<IPermission>('Permission', PermissionSchema);
