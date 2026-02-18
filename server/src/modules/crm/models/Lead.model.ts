import mongoose, { Schema, Document, Types } from 'mongoose';

// ============================================
// ACTIVITY SUB-SCHEMA
// ============================================
export interface ILeadActivity {
    type: 'call' | 'email' | 'meeting' | 'note';
    description: string;
    date: Date;
    createdBy: Types.ObjectId;
}

const LeadActivitySchema = new Schema<ILeadActivity>(
    {
        type: {
            type: String,
            enum: ['call', 'email', 'meeting', 'note'],
            required: true,
        },
        description: { type: String, required: true, trim: true },
        date: { type: Date, default: Date.now },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { _id: true, timestamps: false }
);

// ============================================
// MEETING SUB-SCHEMA
// ============================================
export interface ILeadMeeting {
    type: 'internal' | 'external';
    title: string;
    notes: string;
    date: Date;
    createdBy: Types.ObjectId;
}

const LeadMeetingSchema = new Schema<ILeadMeeting>(
    {
        type: {
            type: String,
            enum: ['internal', 'external'],
            required: true,
        },
        title: { type: String, required: true, trim: true },
        notes: { type: String, trim: true, default: '' },
        date: { type: Date, default: Date.now },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { _id: true, timestamps: false }
);

// ============================================
// LEAD SCHEMA
// ============================================
export interface ILead extends Document {
    _id: Types.ObjectId;
    name: string;
    email: string;
    phone?: string;
    company?: string;

    source: 'website' | 'referral' | 'cold-call' | 'social-media' | 'event' | 'other';
    stage: 'new' | 'contacted' | 'qualified' | 'proposal-sent' | 'negotiation' | 'closed' | 'pending' | 'lead-lost' | 'follow-up';
    priority: 'low' | 'medium' | 'high' | 'critical';

    estimatedValue?: number;
    currency: string;

    notes?: string;
    tags: string[];

    assignedTo?: Types.ObjectId;
    convertedClientId?: Types.ObjectId;

    isLocked: boolean;
    closedAt?: Date;
    lostReason?: string;
    expectedCloseDate?: Date;

    activities: ILeadActivity[];
    meetings: ILeadMeeting[];

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
    {
        name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        phone: { type: String, trim: true },
        company: { type: String, trim: true },

        source: {
            type: String,
            enum: ['website', 'referral', 'cold-call', 'social-media', 'event', 'other'],
            default: 'other',
        },
        stage: {
            type: String,
            enum: ['new', 'contacted', 'qualified', 'proposal-sent', 'negotiation', 'closed', 'pending', 'lead-lost', 'follow-up'],
            default: 'new',
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
        },

        estimatedValue: { type: Number, min: 0 },
        currency: { type: String, default: 'INR' },

        notes: { type: String, trim: true },
        tags: [{ type: String, trim: true, lowercase: true }],

        assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
        convertedClientId: { type: Schema.Types.ObjectId, ref: 'Client' },

        isLocked: { type: Boolean, default: false },
        closedAt: { type: Date },
        lostReason: { type: String, trim: true },
        expectedCloseDate: { type: Date },

        activities: [LeadActivitySchema],
        meetings: [LeadMeetingSchema],

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    {
        timestamps: true,
    }
);

// Indexes
LeadSchema.index({ stage: 1 });
LeadSchema.index({ assignedTo: 1 });
LeadSchema.index({ source: 1 });
LeadSchema.index({ priority: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ email: 1 });
LeadSchema.index({ tags: 1 });

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
