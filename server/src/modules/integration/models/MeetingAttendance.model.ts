import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A single join/leave session from Google Meet.
 * One participant can have multiple sessions (leave + rejoin, or multiple devices).
 */
export interface IAttendanceSession {
    /** Google's identifier for this specific session — used for idempotent upserts */
    sessionId?: string;
    joinTime: Date;
    /** Null/undefined if the conference is still active */
    leaveTime?: Date;
    /** e.g. 'desktop', 'mobile', 'unknown' */
    deviceType?: string;
}

/**
 * Per-employee attendance record for a single Meeting.
 * One document per (meetingId, participant identity) pair.
 * Sessions are merged via the interval-union algorithm to calculate actualAttendanceMinutes.
 */
export interface IMeetingAttendance extends Document {
    _id: Types.ObjectId;
    /** Reference to Meeting._id */
    meetingId: Types.ObjectId;
    /** CUOS User._id — null if participant could not be mapped to a CUOS user */
    userId?: Types.ObjectId;
    /** Google's participant identifier (used for upsert deduplication) */
    googleParticipantId?: string;
    /** Email reported by Google for this participant */
    googleEmail?: string;
    /** Display name reported by Google (informational only, NOT used for identity) */
    displayName?: string;
    /** All individual join/leave sessions for this participant in this meeting */
    sessions: IAttendanceSession[];
    /**
     * Unique attendance duration in minutes, calculated as the union of all sessions.
     * Handles leave+rejoin and multiple devices correctly.
     */
    actualAttendanceMinutes?: number;
    /** Link to the TimeLog created for this attendance (if applicable) */
    timeLogId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
    {
        sessionId: { type: String, trim: true },
        joinTime: { type: Date, required: true },
        leaveTime: Date,
        deviceType: { type: String, trim: true },
    },
    { _id: false }
);

const MeetingAttendanceSchema = new Schema<IMeetingAttendance>(
    {
        meetingId: {
            type: Schema.Types.ObjectId,
            ref: 'Meeting',
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        googleParticipantId: {
            type: String,
            trim: true,
        },
        googleEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },
        displayName: {
            type: String,
            trim: true,
        },
        sessions: {
            type: [AttendanceSessionSchema],
            default: [],
        },
        actualAttendanceMinutes: {
            type: Number,
            min: 0,
        },
        timeLogId: {
            type: Schema.Types.ObjectId,
            ref: 'TimeLog',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
MeetingAttendanceSchema.index({ meetingId: 1 });
MeetingAttendanceSchema.index({ userId: 1 });
// Compound: one attendance record per user per meeting (for CUOS users)
MeetingAttendanceSchema.index(
    { meetingId: 1, userId: 1 },
    { unique: true, sparse: true }
);
// For session-level idempotency lookups
MeetingAttendanceSchema.index(
    { meetingId: 1, googleParticipantId: 1 },
    { unique: true, sparse: true }
);

export const MeetingAttendance = mongoose.model<IMeetingAttendance>(
    'MeetingAttendance',
    MeetingAttendanceSchema
);
