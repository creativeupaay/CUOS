import mongoose, { Schema, Document, Types } from 'mongoose';
import type { JobApplicationFieldType } from './Job.model';

export type ApplicationStatus =
    | 'new'
    | 'screening'
    | 'shortlisted'
    | 'assignment-round'
    | 'assignment-submitted'
    | 'interview'
    | 'interview-scheduled'
    | 'interview-rescheduled'
    | 'interview-cancelled'
    | 'rejected'
    | 'offered'
    | 'hired';

export interface IApplication extends Document {
    _id: Types.ObjectId;
    jobId: Types.ObjectId;
    name: string;
    email: string;
    phone: string;
    resumeUrl: string;
    resumeCloudinaryId?: string;
    portfolio?: string;
    linkedin?: string;
    github?: string;
    experience?: string;
    coverLetter?: string;
    location?: string;
    yearsOfExperience?: number;
    figmaUrl?: string;
    customFieldResponses: Array<{
        key: string;
        label: string;
        type: JobApplicationFieldType;
        value?: string;
        fileUrl?: string;
        fileCloudinaryId?: string;
        fileName?: string;
        mimeType?: string;
        size?: number;
    }>;
    status: ApplicationStatus;
    tags: string[];
    assignmentWindowStartedAt?: Date;
    assignmentWindowExpiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ApplicationCustomFieldResponseSchema = new Schema(
    {
        key: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ['text', 'url', 'number', 'note', 'date', 'attachment'],
            required: true,
        },
        value: { type: String, trim: true },
        fileUrl: { type: String, trim: true },
        fileCloudinaryId: { type: String, trim: true },
        fileName: { type: String, trim: true },
        mimeType: { type: String, trim: true },
        size: { type: Number },
    },
    { _id: false }
);

const ApplicationSchema = new Schema<IApplication>(
    {
        jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, required: true, trim: true },
        resumeUrl: { type: String, required: true, trim: true },
        resumeCloudinaryId: { type: String, trim: true },
        portfolio: { type: String, trim: true },
        linkedin: { type: String, trim: true },
        github: { type: String, trim: true },
        experience: { type: String, trim: true },
        coverLetter: { type: String, trim: true },
        location: { type: String, trim: true },
        yearsOfExperience: { type: Number },
        figmaUrl: { type: String, trim: true },
        customFieldResponses: {
            type: [ApplicationCustomFieldResponseSchema],
            default: [],
        },
        status: {
            type: String,
            enum: [
                'new',
                'screening',
                'shortlisted',
                'assignment-round',
                'assignment-submitted',
                'interview',
                'interview-scheduled',
                'interview-rescheduled',
                'interview-cancelled',
                'rejected',
                'offered',
                'hired',
            ],
            default: 'new',
        },
        tags: [{ type: String, trim: true, lowercase: true }],
        assignmentWindowStartedAt: { type: Date },
        assignmentWindowExpiresAt: { type: Date },
    },
    {
        timestamps: true,
    }
);

ApplicationSchema.index({ jobId: 1, createdAt: -1 });
ApplicationSchema.index({ status: 1, createdAt: -1 });
ApplicationSchema.index({ tags: 1 });
ApplicationSchema.index({ email: 1 });

export const Application = mongoose.model<IApplication>('Application', ApplicationSchema);
