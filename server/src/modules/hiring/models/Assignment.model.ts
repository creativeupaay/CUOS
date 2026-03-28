import mongoose, { Document, Schema, Types } from 'mongoose';

export type AssignmentCustomSubmissionFieldType =
    | 'text'
    | 'url'
    | 'number'
    | 'note'
    | 'date'
    | 'attachment';

export interface IAssignmentCustomSubmissionField {
    key: string;
    label: string;
    type: AssignmentCustomSubmissionFieldType;
    placeholder?: string;
    createdAt?: Date;
}

export interface IAssignmentSubmissionFields {
    githubLink: boolean;
    demoLink: boolean;
    videoLink: boolean;
    figmaLink: boolean;
    attachments: boolean;
    notes: boolean;
    customFields: IAssignmentCustomSubmissionField[];
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
            figmaLink: { type: Boolean, default: false },
            attachments: { type: Boolean, default: false },
            notes: { type: Boolean, default: true },
            customFields: {
                type: [
                    new Schema<IAssignmentCustomSubmissionField>(
                        {
                            key: { type: String, required: true, trim: true },
                            label: { type: String, required: true, trim: true },
                            type: {
                                type: String,
                                enum: ['text', 'url', 'number', 'note', 'date', 'attachment'],
                                required: true,
                            },
                            placeholder: { type: String, trim: true },
                            createdAt: { type: Date, default: Date.now },
                        },
                        { _id: false }
                    ),
                ],
                default: [],
            },
        },
    },
    {
        timestamps: true,
    }
);

AssignmentSchema.index({ jobId: 1, createdAt: -1 });

export const Assignment = mongoose.model<IAssignment>('Assignment', AssignmentSchema);
