import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Revenue Sources ─────────────────────────────────────────────────
export type RevenueSource = 'project' | 'manual' | 'interest' | 'refund' | 'other';
export type RevenueStatus = 'pending' | 'received' | 'partially_received';

// ── Interface ───────────────────────────────────────────────────────
export interface IRevenue extends Document {
    _id: Types.ObjectId;
    title: string;
    description?: string;
    source: RevenueSource;
    // Amounts
    amount: number;
    currency: string;
    exchangeRate: number;
    amountInBaseCurrency: number;
    // GST/Tax
    gstApplicable: boolean;
    gstAmount: number;
    gstRate: number;
    amountWithoutGst: number;
    // TDS
    tdsApplicable: boolean;
    tdsAmount: number;
    tdsRate: number;
    // Received
    amountReceived: number;
    receivedDate?: Date;
    // Linking
    projectId?: Types.ObjectId;
    clientId?: Types.ObjectId;
    invoiceId?: Types.ObjectId;
    // Accrual tracking
    accrualMonth: number;
    accrualYear: number;
    cashMonth?: number;
    cashYear?: number;
    // Status
    status: RevenueStatus;
    // Meta
    notes?: string;
    attachments?: string[];
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const RevenueSchema = new Schema<IRevenue>(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        source: {
            type: String,
            required: true,
            enum: ['project', 'manual', 'interest', 'refund', 'other'],
            default: 'manual',
        },
        // Amounts
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'INR', trim: true, uppercase: true },
        exchangeRate: { type: Number, default: 1, min: 0 },
        amountInBaseCurrency: { type: Number, required: true, min: 0 },
        // GST
        gstApplicable: { type: Boolean, default: true },
        gstAmount: { type: Number, default: 0, min: 0 },
        gstRate: { type: Number, default: 18, min: 0 },
        amountWithoutGst: { type: Number, required: true, min: 0 },
        // TDS
        tdsApplicable: { type: Boolean, default: false },
        tdsAmount: { type: Number, default: 0, min: 0 },
        tdsRate: { type: Number, default: 0, min: 0 },
        // Received
        amountReceived: { type: Number, default: 0, min: 0 },
        receivedDate: Date,
        // Linking
        projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
        invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
        // Accrual tracking (when revenue is earned)
        accrualMonth: { type: Number, required: true, min: 1, max: 12 },
        accrualYear: { type: Number, required: true },
        // Cash tracking (when payment is received)
        cashMonth: { type: Number, min: 1, max: 12 },
        cashYear: { type: Number },
        // Status
        status: {
            type: String,
            enum: ['pending', 'received', 'partially_received'],
            default: 'pending',
        },
        // Meta
        notes: { type: String, trim: true },
        attachments: [{ type: String }],
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────────────────
RevenueSchema.index({ source: 1 });
RevenueSchema.index({ projectId: 1 });
RevenueSchema.index({ clientId: 1 });
RevenueSchema.index({ accrualYear: 1, accrualMonth: 1 });
RevenueSchema.index({ cashYear: 1, cashMonth: 1 });
RevenueSchema.index({ status: 1 });
RevenueSchema.index({ createdBy: 1 });

// Auto-compute amounts before save
RevenueSchema.pre('save', function (next) {
    // Calculate base currency amount
    this.amountInBaseCurrency = Math.round(this.amount * this.exchangeRate * 100) / 100;

    // Calculate GST if applicable
    if (this.gstApplicable && this.gstRate > 0) {
        // If amount includes GST, calculate backward
        this.amountWithoutGst = Math.round((this.amountInBaseCurrency / (1 + this.gstRate / 100)) * 100) / 100;
        this.gstAmount = Math.round((this.amountInBaseCurrency - this.amountWithoutGst) * 100) / 100;
    } else {
        this.amountWithoutGst = this.amountInBaseCurrency;
        this.gstAmount = 0;
    }

    // Calculate TDS if applicable (TDS on base amount without GST)
    if (this.tdsApplicable && this.tdsRate > 0) {
        this.tdsAmount = Math.round((this.amountWithoutGst * this.tdsRate / 100) * 100) / 100;
    } else {
        this.tdsAmount = 0;
    }

    // Update status based on received amount
    if (this.amountReceived >= this.amountInBaseCurrency) {
        this.status = 'received';
    } else if (this.amountReceived > 0) {
        this.status = 'partially_received';
    } else {
        this.status = 'pending';
    }

    next();
});

export const Revenue = mongoose.model<IRevenue>('Revenue', RevenueSchema);
