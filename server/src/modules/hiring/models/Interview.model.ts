import mongoose, { Document, Schema, Types } from 'mongoose';

export type InterviewStatus =
    | 'scheduled'
    | 'completed'
    | 'cancelled'
    | 'rescheduled'
    | 'no-show';

export interface IInterview extends Document {
    _id: Types.ObjectId;
    applicationId: Types.ObjectId;
    scheduledTime: Date;
    meetLink: string;
    interviewer: string;
    status: InterviewStatus;
    calcomBookingId?: string;
    calcomBookingUid?: string;
    calcomEventTypeId?: number;
    lastWebhookEvent?: string;
    lastWebhookHash?: string;
    lastWebhookAt?: Date;
    reminderScheduledFor?: Date;
    reminderTargetScheduledTime?: Date;
    reminderSentAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const InterviewSchema = new Schema<IInterview>(
    {
        applicationId: {
            type: Schema.Types.ObjectId,
            ref: 'Application',
            required: true,
            index: true,
            unique: true,
        },
        scheduledTime: { type: Date, required: true, index: true },
        meetLink: { type: String, required: true, trim: true },
        interviewer: { type: String, required: true, trim: true },
        status: {
            type: String,
            enum: ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no-show'],
            default: 'scheduled',
            index: true,
        },
        calcomBookingId: { type: String, trim: true, index: true, sparse: true },
        calcomBookingUid: { type: String, trim: true, index: true, sparse: true },
        calcomEventTypeId: { type: Number, index: true, sparse: true },
        lastWebhookEvent: { type: String, trim: true },
        lastWebhookHash: { type: String, trim: true },
        lastWebhookAt: { type: Date },
        reminderScheduledFor: { type: Date },
        reminderTargetScheduledTime: { type: Date },
        reminderSentAt: { type: Date },
    },
    {
        timestamps: true,
    }
);

InterviewSchema.index({ status: 1, scheduledTime: 1 });
InterviewSchema.index({ applicationId: 1, calcomBookingUid: 1 });

export const Interview = mongoose.model<IInterview>('Interview', InterviewSchema);
