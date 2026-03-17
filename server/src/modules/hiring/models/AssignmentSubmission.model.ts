import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAssignmentSubmission extends Document {
    _id: Types.ObjectId;
    assignmentId: Types.ObjectId;
    applicationId: Types.ObjectId;
    githubLink?: string;
    demoLink?: string;
    videoLink?: string;
    notes?: string;
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
        notes: { type: String, trim: true },
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
