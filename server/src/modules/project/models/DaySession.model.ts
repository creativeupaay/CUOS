import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * DaySession — persists a user's day timer state on the server.
 * One document per user per calendar day (enforced by unique index).
 *
 * This is the source-of-truth for the universal timer so that:
 *  - Multiple browser tabs share the same elapsed time
 *  - Multiple devices share the same elapsed time
 *  - If a user ends the day and restarts within the same day, the timer
 *    resumes from the accumulated seconds (not from zero).
 *  - A new calendar day always starts a fresh session.
 */
export interface IDaySession extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;

    /** ISO date string in user's local timezone, e.g. "2026-08-18" */
    dateKey: string;

    /** Total seconds accumulated across all paused segments of today */
    accumulated: number;

    /**
     * Epoch ms at which the current run segment started.
     * null when the session is paused.
     */
    startedAt: number | null;

    status: 'running' | 'paused';

    /** When the user first pressed Start today */
    dayStart: Date;

    /** Last time the session was paused (for audit/display) */
    lastPausedAt: Date | null;

    /** True if the 12-hour cap has been manually bypassed */
    limitBypassed: boolean;

    /** True if the user has officially ended their day */
    isEnded: boolean;

    /** Total break seconds accumulated today */
    breakAccumulated: number;

    /** Epoch ms when the current break started. null if not on break. */
    breakStartedAt: number | null;

    /** Type of the current or last break: lunch, tea, or other */
    breakType: 'lunch' | 'tea' | 'other' | null;

    /** Custom reason provided when breakType is 'other' */
    breakReason: string | null;

    /** Accumulated seconds at the time the user ended the day */
    lastEndedAccumulated?: number;

    /** Break accumulated seconds at the time the user ended the day */
    lastEndedBreakAccumulated?: number;

    /** Total working seconds allocated today across all submissions */
    allocatedSeconds?: number;

    createdAt: Date;
    updatedAt: Date;
}

const DaySessionSchema = new Schema<IDaySession>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        dateKey: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
        },
        accumulated: {
            type: Number,
            default: 0,
            min: 0,
        },
        startedAt: {
            type: Number,  // epoch ms
            default: null,
        },
        status: {
            type: String,
            enum: ['running', 'paused'],
            default: 'paused',
        },
        dayStart: {
            type: Date,
            required: true,
        },
        lastPausedAt: {
            type: Date,
            default: null,
        },
        limitBypassed: {
            type: Boolean,
            default: false,
        },
        isEnded: {
            type: Boolean,
            default: false,
        },
        breakAccumulated: {
            type: Number,
            default: 0,
            min: 0,
        },
        breakStartedAt: {
            type: Number,  // epoch ms
            default: null,
        },
        breakType: {
            type: String,
            enum: ['lunch', 'tea', 'other', null],
            default: null,
        },
        breakReason: {
            type: String,
            default: null,
        },
        lastEndedAccumulated: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastEndedBreakAccumulated: {
            type: Number,
            default: 0,
            min: 0,
        },
        allocatedSeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

// Unique: one session per user per calendar day
DaySessionSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
DaySessionSchema.index({ userId: 1 });

export const DaySession = mongoose.model<IDaySession>('DaySession', DaySessionSchema);
