import mongoose, { Document, Schema, Types } from 'mongoose';

export type ActivityActorType = 'candidate' | 'user' | 'system';

export interface IApplicationActivity extends Document {
    _id: Types.ObjectId;
    applicationId: Types.ObjectId;
    type: string;
    title: string;
    description: string;
    actorType: ActivityActorType;
    actorId?: Types.ObjectId;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const ApplicationActivitySchema = new Schema<IApplicationActivity>(
    {
        applicationId: {
            type: Schema.Types.ObjectId,
            ref: 'Application',
            required: true,
            index: true,
        },
        type: { type: String, required: true, trim: true, index: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        actorType: {
            type: String,
            enum: ['candidate', 'user', 'system'],
            default: 'system',
            index: true,
        },
        actorId: { type: Schema.Types.ObjectId, ref: 'User' },
        metadata: { type: Schema.Types.Mixed },
    },
    {
        timestamps: true,
    }
);

ApplicationActivitySchema.index({ applicationId: 1, createdAt: -1 });

export const ApplicationActivity = mongoose.model<IApplicationActivity>(
    'ApplicationActivity',
    ApplicationActivitySchema
);
