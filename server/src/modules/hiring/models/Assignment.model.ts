import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAssignmentSubmissionFields {
    githubLink: boolean;
    demoLink: boolean;
    videoLink: boolean;
    notes: boolean;
}

export interface IAssignment extends Document {
    _id: Types.ObjectId;
    jobId: Types.ObjectId;
    title: string;
    description: string;
    instructions: string;
    timeLimitDays: number;
    timeLimitHours?: number;
    submissionFields: IAssignmentSubmissionFields;
    createdAt: Date;
    updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
    {
        jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        instructions: { type: String, required: true, trim: true },
        timeLimitDays: { type: Number, required: true, min: 1, default: 2 },
        // Legacy field retained for backward compatibility with existing records.
        timeLimitHours: { type: Number, min: 1 },
        submissionFields: {
            githubLink: { type: Boolean, default: true },
            demoLink: { type: Boolean, default: true },
            videoLink: { type: Boolean, default: true },
            notes: { type: Boolean, default: true },
        },
    },
    {
        timestamps: true,
    }
);

AssignmentSchema.index({ jobId: 1, createdAt: -1 });

export const Assignment = mongoose.model<IAssignment>('Assignment', AssignmentSchema);
