import mongoose, { Schema, Document, Types } from 'mongoose';

export type InterviewScheduleSyncStatus = 'not_configured' | 'pending' | 'synced' | 'failed';

export interface IInterviewDailySlot {
    startTime: string;
    endTime: string;
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
    availableFrom?: Date;
    availableTo?: Date;
    weekdays: number[];
    dailySlots: IInterviewDailySlot[];
    durationMinutes: number;
    slotIntervalMinutes: number;
    minimumBookingNoticeMinutes: number;
    beforeEventBufferMinutes: number;
    afterEventBufferMinutes: number;
    syncStatus: InterviewScheduleSyncStatus;
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
        availableFrom: { type: Date },
        availableTo: { type: Date },
        weekdays: {
            type: [Number],
            default: [1, 2, 3, 4, 5],
        },
        dailySlots: {
            type: [InterviewDailySlotSchema],
            default: [{ startTime: '10:00', endTime: '18:00' }],
        },
        durationMinutes: { type: Number, default: 45 },
        slotIntervalMinutes: { type: Number, default: 30 },
        minimumBookingNoticeMinutes: { type: Number, default: 60 },
        beforeEventBufferMinutes: { type: Number, default: 5 },
        afterEventBufferMinutes: { type: Number, default: 5 },
        syncStatus: {
            type: String,
            enum: ['not_configured', 'pending', 'synced', 'failed'],
            default: 'not_configured',
        },
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
        interviewScheduling: {
            type: InterviewSchedulingConfigSchema,
            default: () => ({
                enabled: false,
                active: false,
                timezone: 'Asia/Kolkata',
                organizerName: 'HR Team',
                weekdays: [1, 2, 3, 4, 5],
                dailySlots: [{ startTime: '10:00', endTime: '18:00' }],
                durationMinutes: 45,
                slotIntervalMinutes: 30,
                minimumBookingNoticeMinutes: 60,
                beforeEventBufferMinutes: 5,
                afterEventBufferMinutes: 5,
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
