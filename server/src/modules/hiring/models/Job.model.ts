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
JobSchema.index({ 'interviewScheduling.eventTypeId': 1 });
JobSchema.index({ 'interviewScheduling.enabled': 1, 'interviewScheduling.syncStatus': 1 });

export const Job = mongoose.model<IJob>('Job', JobSchema);
