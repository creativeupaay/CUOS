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

    projectId: Types.ObjectId;

    participants: IMeetingParticipant[];

    scheduledAt: Date;
    duration: number; // in minutes
    location?: string;

    agenda?: string;
    notes?: string;
    actionItems?: IMeetingActionItem[];

    accessLevel: 'project-team' | 'managers-only' | 'custom';
    customAccessUsers?: Types.ObjectId[];

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
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

        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },

        participants: [MeetingParticipantSchema],

        scheduledAt: { type: Date, required: true },
        duration: { type: Number, required: true, min: 1 }, // in minutes
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

export const Meeting = mongoose.model<IMeeting>('Meeting', MeetingSchema);
