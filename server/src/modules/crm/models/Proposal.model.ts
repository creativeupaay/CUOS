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
// DOCUMENT SUB-SCHEMA
// ============================================
export interface IProposalDocument {
    name: string;
    cloudinaryId: string;
    uploadedAt: Date;
    uploadedBy: Types.ObjectId;
}

const ProposalDocumentSchema = new Schema<IProposalDocument>(
    {
        name: { type: String, required: true, trim: true },
        cloudinaryId: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { _id: true }
);

// ============================================
// AUDIT LOG SUB-SCHEMA
// ============================================
export interface IProposalAuditEntry {
    action: string;
    performedBy: Types.ObjectId;
    performedAt: Date;
    details?: string;
}

const ProposalAuditEntrySchema = new Schema<IProposalAuditEntry>(
    {
        action: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        performedAt: { type: Date, default: Date.now },
        details: { type: String },
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

    version: number;
    parentProposalId?: Types.ObjectId;
    scope?: string;

    validUntil?: Date;

    items: IProposalLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;

    documents: IProposalDocument[];
    auditLog: IProposalAuditEntry[];

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

        version: { type: Number, default: 1 },
        parentProposalId: { type: Schema.Types.ObjectId, ref: 'Proposal' },
        scope: { type: String, trim: true },

        validUntil: { type: Date },

        items: [ProposalLineItemSchema],
        subtotal: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        total: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'INR' },

        documents: [ProposalDocumentSchema],
        auditLog: [ProposalAuditEntrySchema],

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
