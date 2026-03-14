import mongoose, { Schema, Document, Types } from 'mongoose';

// ============================================
// JOB SCHEMA
// ============================================
export interface IJob extends Document {
    _id: Types.ObjectId;
    title: string;
    department: string;
    location: string;
    description: string;
    requirements: string;
    employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
    isHiring: boolean;
    assignmentRequired: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
    {
        title: { type: String, required: true, trim: true },
        department: { type: String, required: true, trim: true },
        location: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        requirements: { type: String, required: true, trim: true },
        employmentType: {
            type: String,
            enum: ['full-time', 'part-time', 'contract', 'internship'],
            default: 'full-time',
        },
        isHiring: { type: Boolean, default: false },
        assignmentRequired: { type: Boolean, default: false },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    {
        timestamps: true,
    }
);

// Indexes
JobSchema.index({ isHiring: 1 });
JobSchema.index({ department: 1 });
JobSchema.index({ employmentType: 1 });
JobSchema.index({ createdAt: -1 });

export const Job = mongoose.model<IJob>('Job', JobSchema);
