import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRole extends Document {
    name: string;
    description: string;
    permissions: Types.ObjectId[];
    level: number;
    createdAt: Date;
    updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        description: {
            type: String,
            required: true,
        },
        permissions: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Permission',
            },
        ],
        level: {
            type: Number,
            required: true,
            min: 1,
            max: 10,
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
RoleSchema.index({ name: 1 });
RoleSchema.index({ level: 1 });

export const Role = mongoose.model<IRole>('Role', RoleSchema);
