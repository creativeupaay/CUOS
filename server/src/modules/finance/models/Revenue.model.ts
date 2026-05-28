import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRevenue extends Document {
    _id: Types.ObjectId;
    date: Date;
    description: string;
    client: string;
    clientId?: Types.ObjectId; // Link to CRM client if exists
    project?: string;
    projectId?: Types.ObjectId; // Link to project if applicable
    phaseId?: Types.ObjectId; // Link to specific project phase if applicable

    // Amount details
    amount: number;
    currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
    exchangeRate: number;
    exchangeRateDate?: Date;
    exchangeRateProvider?: string;
    amountINR: number; // Converted amount in INR

    // Tax details
    gstApplicable: boolean;
    gstRate: number; // 5, 12, 18, or 28
    gst: number;
    tdsDeducted: number;
    totalAmount: number; // amountINR + gst - tdsDeducted
    fxFeesINR?: number;
    tipINR?: number;

    // Payment tracking
    receivedAmount: number;
    pendingAmount: number;

    // Source
    source: 'manual' | 'invoice' | 'project';
    status: 'received' | 'pending' | 'partial' | 'overdue';

    // Invoice details
    invoiceNumber?: string;
    invoiceId?: Types.ObjectId;
    dueDate?: Date;

    // Additional
    notes?: string;
    attachments?: string[];
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const RevenueSchema = new Schema<IRevenue>(
    {
        date: { type: Date, required: true },
        description: { type: String, required: true, trim: true },
        client: { type: String, required: true, trim: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
        project: { type: String, trim: true },
        projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
        phaseId: { type: Schema.Types.ObjectId },

        // Amount details
        amount: { type: Number, required: true, min: 0 },
        currency: {
            type: String,
            enum: ['INR', 'USD', 'EUR', 'GBP', 'AED'],
            default: 'INR',
        },
        exchangeRate: { type: Number, default: 1, min: 0 },
        exchangeRateDate: Date,
        exchangeRateProvider: { type: String, trim: true },
        amountINR: { type: Number, required: true, min: 0 },

        // Tax details
        gstApplicable: { type: Boolean, default: true },
        gstRate: { type: Number, default: 18, enum: [0, 5, 12, 18, 28] },
        gst: { type: Number, default: 0, min: 0 },
        tdsDeducted: { type: Number, default: 0, min: 0 },
        totalAmount: { type: Number, required: true, min: 0 },
        fxFeesINR: { type: Number, default: 0 },
        tipINR: { type: Number, default: 0 },

        // Payment tracking
        receivedAmount: { type: Number, default: 0, min: 0 },
        pendingAmount: { type: Number, default: 0, min: 0 },

        // Source
        source: {
            type: String,
            enum: ['manual', 'invoice', 'project'],
            default: 'manual',
        },
        status: {
            type: String,
            enum: ['received', 'pending', 'partial', 'overdue'],
            default: 'pending',
        },

        // Invoice details
        invoiceNumber: { type: String, trim: true },
        invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
        dueDate: Date,

        // Additional
        notes: { type: String, trim: true },
        attachments: [{ type: String }],
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
    }
);

// Calculate pending amount before save
RevenueSchema.pre('save', function (next) {
    this.pendingAmount = this.totalAmount - this.receivedAmount;

    // Auto-update status based on received amount
    const effectiveReceived = this.receivedAmount + (this.fxFeesINR || 0);
    if (effectiveReceived >= this.totalAmount) {
        this.status = 'received';
    } else if (this.receivedAmount > 0) {
        this.status = 'partial';
    } else if (this.dueDate && new Date() > this.dueDate) {
        this.status = 'overdue';
    } else {
        this.status = 'pending';
    }

    next();
});

// Indexes
RevenueSchema.index({ date: 1 });
RevenueSchema.index({ status: 1 });
RevenueSchema.index({ source: 1 });
RevenueSchema.index({ client: 1 });
RevenueSchema.index({ projectId: 1 });
RevenueSchema.index({ createdAt: -1 });
RevenueSchema.index({ date: 1, status: 1 }); // For dashboard queries

export const Revenue = mongoose.model<IRevenue>('Revenue', RevenueSchema);
