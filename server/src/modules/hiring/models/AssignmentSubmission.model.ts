import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAssignmentSubmissionAttachment {
    name: string;
    url: string;
    mimeType: string;
    size: number;
    cloudinaryId?: string;
}

export interface IAssignmentSubmissionCustomFieldResponse {
    key: string;
    label: string;
    type: 'text' | 'url' | 'number' | 'note' | 'date' | 'attachment';
    value?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    cloudinaryId?: string;
}

export interface IAssignmentSubmission extends Document {
    _id: Types.ObjectId;
    assignmentId: Types.ObjectId;
    applicationId: Types.ObjectId;
    githubLink?: string;
    demoLink?: string;
    videoLink?: string;
    figmaLink?: string;
    attachments?: IAssignmentSubmissionAttachment[];
    notes?: string;
    customFieldResponses?: IAssignmentSubmissionCustomFieldResponse[];
    submittedAt: Date;
    deadlineAt?: Date;
    submittedAfterDeadline: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const AssignmentSubmissionSchema = new Schema<IAssignmentSubmission>(
    {
        assignmentId: {
            type: Schema.Types.ObjectId,
            ref: 'Assignment',
            required: true,
            index: true,
        },
        applicationId: {
            type: Schema.Types.ObjectId,
            ref: 'Application',
            required: true,
            index: true,
        },
        githubLink: { type: String, trim: true },
        demoLink: { type: String, trim: true },
        videoLink: { type: String, trim: true },
        figmaLink: { type: String, trim: true },
        attachments: [
            {
                name: { type: String, trim: true, required: true },
                url: { type: String, trim: true, required: true },
                mimeType: { type: String, trim: true, required: true },
                size: { type: Number, required: true },
                cloudinaryId: { type: String, trim: true },
            },
        ],
        notes: { type: String, trim: true },
        customFieldResponses: [
            {
                key: { type: String, trim: true, required: true },
                label: { type: String, trim: true, required: true },
                type: {
                    type: String,
                    enum: ['text', 'url', 'number', 'note', 'date', 'attachment'],
                    required: true,
                },
                value: { type: String, trim: true },
                fileName: { type: String, trim: true },
                mimeType: { type: String, trim: true },
                size: { type: Number },
                cloudinaryId: { type: String, trim: true },
            },
        ],
        submittedAt: { type: Date, required: true, default: Date.now },
        deadlineAt: { type: Date },
        submittedAfterDeadline: { type: Boolean, required: true, default: false },
    },
    {
        timestamps: true,
    }
);

AssignmentSubmissionSchema.index({ assignmentId: 1, applicationId: 1 }, { unique: true });
AssignmentSubmissionSchema.index({ submittedAt: -1 });

export const AssignmentSubmission = mongoose.model<IAssignmentSubmission>(
    'AssignmentSubmission',
    AssignmentSubmissionSchema
);
