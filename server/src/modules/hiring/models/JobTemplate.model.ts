import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IJobTemplate extends Document {
    _id: Types.ObjectId;
    templateName: string;
    title?: string;
    department?: string;
    locationType: 'Remote' | 'In-Office';
    location?: string;
    description?: string;
    requirements?: string;
    employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const JobTemplateSchema = new Schema<IJobTemplate>(
    {
        templateName: { type: String, required: true, trim: true },
        title: { type: String, trim: true, default: '' },
        department: { type: String, trim: true, default: '' },
        locationType: {
            type: String,
            enum: ['Remote', 'In-Office'],
            default: 'In-Office',
        },
        location: { type: String, trim: true, default: '' },
        description: { type: String, trim: true, default: '' },
        requirements: { type: String, trim: true, default: '' },
        employmentType: {
            type: String,
            enum: ['full-time', 'part-time', 'contract', 'internship'],
            default: 'full-time',
        },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    {
        timestamps: true,
    }
);

JobTemplateSchema.index({ createdAt: -1 });

export const JobTemplate = mongoose.model<IJobTemplate>('JobTemplate', JobTemplateSchema);
