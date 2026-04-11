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
        required: { type: Boolean, default: false },
    },
    { _id: false }
);

const JobApplicationStandardFieldSettingSchema = new Schema(
    {
        key: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        placeholder: { type: String, trim: true },
        helpText: { type: String, trim: true },
        required: { type: Boolean, default: false },
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
        pageSections: {
            showAboutCompany: { type: Boolean, default: true },
            showAboutRole: { type: Boolean, default: true },
            showRequirements: { type: Boolean, default: true },
            showWhatYouGet: { type: Boolean, default: true },
            aboutCompany: {
                type: String,
                default:
                    'Creative Upaay is a tech and design partner that works closely with Startups and Enterprises to build AI based digital products and systems. Our work goes beyond just design or development, we focus on creating practical, scalable solutions that teams actually use. We work across 10+ Industries, for their Custom web solution development, automation workflows, and AI based tools. A lot of our projects involve understanding messy real-world processes and turning them into structured digital experiences.\n\nSo far, we have worked with 85+ brands globally and delivered 350+ projects.\n\nWe look for people who take ownership, think in systems, and care about solving real problems, not just completing tasks. Our Team culture is simple: low ego, high responsibility, honest communication, and a strong focus on doing quality work that actually makes an impact.',
                trim: true,
            },
            whatYouGet: { type: String, trim: true, default: '' },
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
                pageSections: {
                    showAboutCompany: true,
                    showAboutRole: true,
                    showRequirements: true,
                    showWhatYouGet: true,
                    aboutCompany:
                        'Creative Upaay is a tech and design partner that works closely with Startups and Enterprises to build AI based digital products and systems. Our work goes beyond just design or development, we focus on creating practical, scalable solutions that teams actually use. We work across 10+ Industries, for their Custom web solution development, automation workflows, and AI based tools. A lot of our projects involve understanding messy real-world processes and turning them into structured digital experiences.\n\nSo far, we have worked with 85+ brands globally and delivered 350+ projects.\n\nWe look for people who take ownership, think in systems, and care about solving real problems, not just completing tasks. Our Team culture is simple: low ego, high responsibility, honest communication, and a strong focus on doing quality work that actually makes an impact.',
                    whatYouGet: '',
                },
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
