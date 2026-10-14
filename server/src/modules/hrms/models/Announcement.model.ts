import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAnnouncementAcknowledgment {
    userId: Types.ObjectId;
    seenAt: Date;
}

export interface IPollVote {
    userId: Types.ObjectId;
    votedAt: Date;
}

export interface IPollOption {
    _id: Types.ObjectId;
    text: string;
    votes: IPollVote[];
}

export interface IAnnouncementPoll {
    question: string;
    options: IPollOption[];
    allowMultiple: boolean;
    isClosed?: boolean;
}

export interface IAnnouncement extends Document {
    _id: Types.ObjectId;
    title?: string;
    content: string;
    priority: 'normal' | 'urgent';
    isPinned: boolean;
    targetType: 'all' | 'department' | 'users';
    targetDepartments: string[];
    targetUsers: Types.ObjectId[];
    publishedBy: Types.ObjectId;
    acknowledgedBy: IAnnouncementAcknowledgment[];
    poll?: IAnnouncementPoll;
    createdAt: Date;
    updatedAt: Date;
}

const AnnouncementAcknowledgmentSchema = new Schema<IAnnouncementAcknowledgment>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        seenAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const PollVoteSchema = new Schema<IPollVote>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        votedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const PollOptionSchema = new Schema<IPollOption>(
    {
        text: {
            type: String,
            required: true,
            trim: true,
        },
        votes: {
            type: [PollVoteSchema],
            default: [],
        },
    },
    { _id: true }
);

const AnnouncementPollSchema = new Schema<IAnnouncementPoll>(
    {
        question: {
            type: String,
            required: true,
            trim: true,
        },
        options: {
            type: [PollOptionSchema],
            default: [],
        },
        allowMultiple: {
            type: Boolean,
            default: false,
        },
        isClosed: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
);

const AnnouncementSchema = new Schema<IAnnouncement>(
    {
        title: {
            type: String,
            trim: true,
            default: 'Company Announcement',
        },
        content: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
        },
        priority: {
            type: String,
            enum: ['normal', 'urgent'],
            default: 'normal',
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        targetType: {
            type: String,
            enum: ['all', 'department', 'users'],
            default: 'all',
        },
        targetDepartments: {
            type: [String],
            default: [],
        },
        targetUsers: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        publishedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        acknowledgedBy: {
            type: [AnnouncementAcknowledgmentSchema],
            default: [],
        },
        poll: {
            type: AnnouncementPollSchema,
            default: undefined,
        },
    },
    {
        timestamps: true,
    }
);

AnnouncementSchema.index({ createdAt: -1 });
AnnouncementSchema.index({ targetType: 1 });
AnnouncementSchema.index({ 'acknowledgedBy.userId': 1 });

export const Announcement = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);

