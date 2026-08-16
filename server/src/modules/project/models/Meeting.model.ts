import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMeetingParticipant {
    userId?: Types.ObjectId;
    externalEmail?: string;
    name?: string;
    role?: 'organizer' | 'required' | 'optional';
}

export interface IMeetingActionItem {
    description: string;
    assignedTo?: Types.ObjectId;
    dueDate?: Date;
    completed: boolean;
}

export interface IMeeting extends Document {
    _id: Types.ObjectId;
    title: string;
    description?: string;
    type: 'internal' | 'external';

    projectId?: Types.ObjectId;

    participants: IMeetingParticipant[];

    scheduledAt: Date;
    duration: number; // in minutes (scheduled)
    location?: string;

    agenda?: string;
    notes?: string;
    actionItems?: IMeetingActionItem[];

    accessLevel: 'project-team' | 'managers-only' | 'custom';
    customAccessUsers?: Types.ObjectId[];

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;

    // ── Google Meet fields (all optional — manually created meetings are unaffected) ──
    /** 'manual' for user-created meetings; 'google_meet' for auto-imported ones */
    source: 'manual' | 'google_meet';
    /** Google Meet conference record ID — the primary deduplication key */
    googleConferenceId?: string;
    /** Google Calendar event ID (if a Calendar event exists for this meeting) */
    googleCalendarEventId?: string;
    /** Actual conference start time (from Google Meet data) */
    actualStartTime?: Date;
    /** Actual conference end time (from Google Meet data) */
    actualEndTime?: Date;
    /** Actual conference duration in minutes (may differ from scheduled duration) */
    actualDuration?: number;
    /** Conference lifecycle state */
    conferenceStatus: 'scheduled' | 'active' | 'ended' | 'no_show';
}

const MeetingParticipantSchema = new Schema<IMeetingParticipant>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        externalEmail: String,
        name: String,
        role: {
            type: String,
            enum: ['organizer', 'required', 'optional'],
            default: 'required',
        },
    },
    { _id: false }
);

const MeetingActionItemSchema = new Schema<IMeetingActionItem>(
    {
        description: { type: String, required: true },
        assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
        dueDate: Date,
        completed: { type: Boolean, default: false },
    },
    { _id: true }
);

const MeetingSchema = new Schema<IMeeting>(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        type: {
            type: String,
            enum: ['internal', 'external'],
            required: true,
        },

        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: false },

        participants: [MeetingParticipantSchema],

        scheduledAt: { type: Date, required: true },
        duration: { type: Number, required: true, min: 1 }, // scheduled duration in minutes
        location: String,

        agenda: String,
        notes: String,
        actionItems: [MeetingActionItemSchema],

        accessLevel: {
            type: String,
            enum: ['project-team', 'managers-only', 'custom'],
            default: 'project-team',
        },
        customAccessUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        // ── Google Meet fields ──────────────────────────────────────────────
        source: {
            type: String,
            enum: ['manual', 'google_meet'],
            default: 'manual',
        },
        googleConferenceId: {
            type: String,
            trim: true,
        },
        googleCalendarEventId: {
            type: String,
            trim: true,
        },
        actualStartTime: Date,
        actualEndTime: Date,
        actualDuration: { type: Number, min: 0 }, // minutes
        conferenceStatus: {
            type: String,
            enum: ['scheduled', 'active', 'ended', 'no_show'],
            default: 'scheduled',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for performance
MeetingSchema.index({ projectId: 1 });
MeetingSchema.index({ scheduledAt: 1 });
MeetingSchema.index({ 'participants.userId': 1 });
MeetingSchema.index({ type: 1 });
MeetingSchema.index({ source: 1 });
// Unique sparse index — one CUOS meeting per Google conference occurrence
MeetingSchema.index({ googleConferenceId: 1 }, { unique: true, sparse: true });
MeetingSchema.index({ googleCalendarEventId: 1 }, { sparse: true });
MeetingSchema.index({ conferenceStatus: 1 });

export const Meeting = mongoose.model<IMeeting>('Meeting', MeetingSchema);
