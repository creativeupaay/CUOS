import mongoose, { Schema, Document, Types } from 'mongoose';

export type InterviewScheduleSyncStatus = 'not_configured' | 'pending' | 'synced' | 'failed';

export interface IInterviewDailySlot {
    startTime: string;
    endTime: string;
}

export interface IInterviewAvailabilityRange {
    startDate: Date;
    endDate: Date;
    weekdays?: number[];
    dailySlots?: IInterviewDailySlot[];
}

export interface IInterviewDateOverride {
    date: Date;
    slots: IInterviewDailySlot[];
}

export interface IInterviewSchedulingConfig {
    enabled: boolean;
    active: boolean;
    scheduleId?: number;
    timezone: string;
    organizerName: string;
    eventTypeId?: number;
    eventTypeSlug?: string;
    bookingUrl?: string;
    availableRanges: IInterviewAvailabilityRange[];
    dateOverrides: IInterviewDateOverride[];
    weekdays: number[];
    dailySlots: IInterviewDailySlot[];
    durationMinutes: number;
    beforeEventBufferMinutes: number;
    afterEventBufferMinutes: number;
    reminderMinutesBefore: number[];
    syncStatus: InterviewScheduleSyncStatus;
    syncConfigHash?: string;
    syncError?: string;
    lastSyncedAt?: Date;
    externalUpdatedAt?: Date;
}

export type JobApplicationFieldType =
    | 'text'
    | 'url'
    | 'number'
    | 'note'
    | 'date'
    | 'attachment';

export interface IJobApplicationCustomField {
    key: string;
    label: string;
    type: JobApplicationFieldType;
    placeholder?: string;
    helpText?: string;
    required?: boolean;
}

export interface IJobApplicationStandardFieldSetting {
    key: string;
    label: string;
    placeholder?: string;
    helpText?: string;
    required?: boolean;
}

export interface IJobApplicationFormConfig {
    selectedStandardFields: string[];
    standardFieldSettings: IJobApplicationStandardFieldSetting[];
    customFields: IJobApplicationCustomField[];
    pageSections: {
        showAboutCompany: boolean;
        showAboutRole: boolean;
        showRequirements: boolean;
        showWhatYouGet: boolean;
        aboutCompany: string;
        whatYouGet?: string;
    };
}

// ============================================
// JOB SCHEMA
// ============================================
export interface IJob extends Document {
    _id: Types.ObjectId;
    title: string;
    department: string;
    locationType: 'Remote' | 'In-Office';
    location: string;
    description: string;
    requirements: string;
    employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
    isHiring: boolean;
    assignmentRequired: boolean;
    managers: Types.ObjectId[];
    applicationForm: IJobApplicationFormConfig;
    interviewScheduling: IInterviewSchedulingConfig;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const InterviewDailySlotSchema = new Schema<IInterviewDailySlot>(
    {
        startTime: { type: String, required: true, trim: true },
        endTime: { type: String, required: true, trim: true },
    },
    { _id: false }
);

const InterviewAvailabilityRangeSchema = new Schema<IInterviewAvailabilityRange>(
    {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        weekdays: {
            type: [Number],
            default: undefined,
        },
        dailySlots: {
            type: [InterviewDailySlotSchema],
            default: undefined,
        },
    },
    { _id: false }
);

const InterviewDateOverrideSchema = new Schema<IInterviewDateOverride>(
    {
        date: { type: Date, required: true },
        slots: {
            type: [InterviewDailySlotSchema],
            default: [{ startTime: '10:00', endTime: '18:00' }],
        },
    },
    { _id: false }
);

const InterviewSchedulingConfigSchema = new Schema<IInterviewSchedulingConfig>(
    {
        enabled: { type: Boolean, default: false },
        active: { type: Boolean, default: false },
        scheduleId: { type: Number },
        timezone: { type: String, default: 'Asia/Kolkata', trim: true },
        organizerName: { type: String, default: 'HR Team', trim: true },
        eventTypeId: { type: Number },
        eventTypeSlug: { type: String, trim: true },
        bookingUrl: { type: String, trim: true },
        availableRanges: {
            type: [InterviewAvailabilityRangeSchema],
            default: [],
        },
        dateOverrides: {
            type: [InterviewDateOverrideSchema],
            default: [],
        },
        weekdays: {
            type: [Number],
            default: [1, 2, 3, 4, 5],
        },
        dailySlots: {
            type: [InterviewDailySlotSchema],
            default: [{ startTime: '10:00', endTime: '18:00' }],
        },
        durationMinutes: { type: Number, default: 45 },
        beforeEventBufferMinutes: { type: Number, default: 5 },
        afterEventBufferMinutes: { type: Number, default: 5 },
        reminderMinutesBefore: { type: [Number], default: [30] },
        syncStatus: {
            type: String,
            enum: ['not_configured', 'pending', 'synced', 'failed'],
            default: 'not_configured',
        },
        syncConfigHash: { type: String, trim: true },
        syncError: { type: String, trim: true },
        lastSyncedAt: { type: Date },
        externalUpdatedAt: { type: Date },
    },
    { _id: false }
);

const JobApplicationCustomFieldSchema = new Schema<IJobApplicationCustomField>(
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

const JobApplicationStandardFieldSettingSchema = new Schema<IJobApplicationStandardFieldSetting>(
    {
        key: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        placeholder: { type: String, trim: true },
        helpText: { type: String, trim: true },
        required: { type: Boolean, default: false },
    },
    { _id: false }
);

const JobApplicationFormConfigSchema = new Schema<IJobApplicationFormConfig>(
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

const JobSchema = new Schema<IJob>(
    {
        title: { type: String, required: true, trim: true },
        department: { type: String, required: true, trim: true },
        locationType: {
            type: String,
            enum: ['Remote', 'In-Office'],
            default: 'In-Office',
        },
        location: { type: String, trim: true, default: '' },
        description: { type: String, required: true, trim: true },
        requirements: { type: String, required: true, trim: true },
        employmentType: {
            type: String,
            enum: ['full-time', 'part-time', 'contract', 'internship'],
            default: 'full-time',
        },
        isHiring: { type: Boolean, default: false },
        assignmentRequired: { type: Boolean, default: false },
        managers: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Employee',
            },
        ],
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
        interviewScheduling: {
            type: InterviewSchedulingConfigSchema,
            default: () => ({
                enabled: false,
                active: false,
                timezone: 'Asia/Kolkata',
                organizerName: 'HR Team',
                availableRanges: [],
                dateOverrides: [],
                weekdays: [1, 2, 3, 4, 5],
                dailySlots: [{ startTime: '10:00', endTime: '18:00' }],
                durationMinutes: 45,
                beforeEventBufferMinutes: 5,
                afterEventBufferMinutes: 5,
                reminderMinutesBefore: [30],
                syncStatus: 'not_configured',
            }),
        },
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
JobSchema.index({ managers: 1 });
JobSchema.index({ 'interviewScheduling.eventTypeId': 1 });
JobSchema.index({ 'interviewScheduling.enabled': 1, 'interviewScheduling.syncStatus': 1 });

export const Job = mongoose.model<IJob>('Job', JobSchema);
