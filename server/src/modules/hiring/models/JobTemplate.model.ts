import mongoose, { Schema, Document, Types } from 'mongoose';
import type { IJobApplicationFormConfig } from './Job.model';

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
    applicationForm?: IJobApplicationFormConfig;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const JobApplicationCustomFieldSchema = new Schema(
    {
        key: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ['text', 'url', 'number', 'note', 'date', 'attachment'],
            required: true,
        },
        placeholder: { type: String, trim: true },
        helpText: { type: String, trim: true },
    },
    { _id: false }
);

const JobApplicationStandardFieldSettingSchema = new Schema(
    {
        key: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        placeholder: { type: String, trim: true },
        helpText: { type: String, trim: true },
    },
    { _id: false }
);

const JobApplicationFormConfigSchema = new Schema(
    {
        selectedStandardFields: {
            type: [String],
            default: [],
        },
        standardFieldSettings: {
            type: [JobApplicationStandardFieldSettingSchema],
            default: [],
        },
        customFields: {
            type: [JobApplicationCustomFieldSchema],
            default: [],
        },
    },
    { _id: false }
);

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
        applicationForm: {
            type: JobApplicationFormConfigSchema,
            default: () => ({
                selectedStandardFields: [
                    'portfolio',
                    'linkedin',
                    'experience',
                    'coverLetter',
                ],
                standardFieldSettings: [],
                customFields: [],
            }),
        },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    {
        timestamps: true,
    }
);

JobTemplateSchema.index({ createdAt: -1 });

export const JobTemplate = mongoose.model<IJobTemplate>('JobTemplate', JobTemplateSchema);
