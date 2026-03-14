import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInterviewNote extends Document {
    _id: Types.ObjectId;
    interviewId: Types.ObjectId;
    applicationId: Types.ObjectId;
    rating: number;
    technicalScore: number;
    communicationScore: number;
    notes: string;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const InterviewNoteSchema = new Schema<IInterviewNote>(
    {
        interviewId: {
            type: Schema.Types.ObjectId,
            ref: 'Interview',
            required: true,
            unique: true,
            index: true,
        },
        applicationId: {
            type: Schema.Types.ObjectId,
            ref: 'Application',
            required: true,
            index: true,
        },
        rating: { type: Number, required: true, min: 1, max: 10 },
        technicalScore: { type: Number, required: true, min: 1, max: 10 },
        communicationScore: { type: Number, required: true, min: 1, max: 10 },
        notes: { type: String, required: true, trim: true },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

InterviewNoteSchema.index({ applicationId: 1, createdAt: -1 });

export const InterviewNote = mongoose.model<IInterviewNote>('InterviewNote', InterviewNoteSchema);