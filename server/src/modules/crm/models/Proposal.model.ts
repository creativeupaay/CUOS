import mongoose, { Schema, Document, Types } from 'mongoose';

// ============================================
// LINE ITEM SUB-SCHEMA
// ============================================
export interface IProposalLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

const ProposalLineItemSchema = new Schema<IProposalLineItem>(
    {
        description: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
    },
    { _id: true }
);

// ============================================
// PROPOSAL SCHEMA
// ============================================
export interface IProposal extends Document {
    _id: Types.ObjectId;
    title: string;
    leadId: Types.ObjectId;
    clientId?: Types.ObjectId;

    status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

    validUntil?: Date;

    items: IProposalLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;

    notes?: string;

    sentAt?: Date;
    acceptedAt?: Date;

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ProposalSchema = new Schema<IProposal>(
    {
        title: { type: String, required: true, trim: true },
        leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client' },

        status: {
            type: String,
            enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
            default: 'draft',
        },

        validUntil: { type: Date },

        items: [ProposalLineItemSchema],
        subtotal: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        total: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'INR' },

        notes: { type: String, trim: true },

        sentAt: { type: Date },
        acceptedAt: { type: Date },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    {
        timestamps: true,
    }
);

// Auto-compute subtotal and total before save
ProposalSchema.pre('save', function (next) {
    if (this.items && this.items.length > 0) {
        // Recompute each item total
        this.items.forEach((item) => {
            item.total = item.quantity * item.unitPrice;
        });
        this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
        this.total = this.subtotal + (this.tax || 0);
    }
    next();
});

// Indexes
ProposalSchema.index({ leadId: 1 });
ProposalSchema.index({ clientId: 1 });
ProposalSchema.index({ status: 1 });
ProposalSchema.index({ createdAt: -1 });

export const Proposal = mongoose.model<IProposal>('Proposal', ProposalSchema);
