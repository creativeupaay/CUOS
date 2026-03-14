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
    },
    {
        timestamps: true,
    }
);

InterviewSchema.index({ status: 1, scheduledTime: 1 });

export const Interview = mongoose.model<IInterview>('Interview', InterviewSchema);
