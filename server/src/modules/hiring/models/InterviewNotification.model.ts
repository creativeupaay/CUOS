import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInterviewNotification extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    applicationId: Types.ObjectId;
    interviewId?: Types.ObjectId;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const InterviewNotificationSchema = new Schema<IInterviewNotification>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        applicationId: {
            type: Schema.Types.ObjectId,
            ref: 'Application',
            required: true,
            index: true,
        },
        interviewId: { type: Schema.Types.ObjectId, ref: 'Interview' },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        link: { type: String, trim: true },
        isRead: { type: Boolean, default: false, index: true },
    },
    {
        timestamps: true,
    }
);

InterviewNotificationSchema.index({ userId: 1, createdAt: -1 });

export const InterviewNotification = mongoose.model<IInterviewNotification>(
    'InterviewNotification',
    InterviewNotificationSchema
);
