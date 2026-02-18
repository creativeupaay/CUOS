import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Sub-types ───────────────────────────────────────────────────────
export interface IInvoiceItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

export type InvoiceStatus =
    | 'draft'
    | 'sent'
    | 'partial'
    | 'paid'
    | 'overdue'
    | 'cancelled';

// ── Interface ───────────────────────────────────────────────────────
export interface IInvoice extends Document {
    _id: Types.ObjectId;
    invoiceNumber: string;
    projectId: Types.ObjectId;
    clientId: Types.ObjectId;
    items: IInvoiceItem[];
    subtotal: number;
    gstRate: number;
    gstAmount: number;
    tdsRate: number;
    tdsAmount: number;
    total: number;
    currency: string;
    exchangeRate: number;
    amountInBaseCurrency: number;
    status: InvoiceStatus;
    issueDate: Date;
    dueDate: Date;
    paidAmount: number;
    paidAt?: Date;
    notes?: string;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

// ── Sub-schema ──────────────────────────────────────────────────────
const InvoiceItemSchema = new Schema<IInvoiceItem>(
    {
        description: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        rate: { type: Number, required: true, min: 0 },
        amount: { type: Number, required: true, min: 0 },
    },
    { _id: true }
);

// ── Main Schema ─────────────────────────────────────────────────────
const InvoiceSchema = new Schema<IInvoice>(
    {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
        items: [InvoiceItemSchema],
        subtotal: { type: Number, default: 0, min: 0 },
        gstRate: { type: Number, default: 18, min: 0 },
        gstAmount: { type: Number, default: 0, min: 0 },
        tdsRate: { type: Number, default: 0, min: 0 },
        tdsAmount: { type: Number, default: 0, min: 0 },
        total: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'INR', trim: true, uppercase: true },
        exchangeRate: { type: Number, default: 1, min: 0 },
        amountInBaseCurrency: { type: Number, default: 0, min: 0 },
        status: {
            type: String,
            enum: ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'],
            default: 'draft',
        },
        issueDate: { type: Date, required: true },
        dueDate: { type: Date, required: true },
        paidAmount: { type: Number, default: 0, min: 0 },
        paidAt: Date,
        notes: { type: String, trim: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────────────────
InvoiceSchema.index({ invoiceNumber: 1 });
InvoiceSchema.index({ projectId: 1 });
InvoiceSchema.index({ clientId: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ issueDate: -1 });
InvoiceSchema.index({ dueDate: 1, status: 1 }); // For overdue detection

// Auto-compute totals before save
InvoiceSchema.pre('save', function (next) {
    // Compute each item amount
    if (this.items && this.items.length > 0) {
        this.items.forEach((item) => {
            item.amount = Math.round(item.quantity * item.rate * 100) / 100;
        });
        this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
    }

    // Compute GST and TDS
    this.gstAmount = Math.round(this.subtotal * (this.gstRate / 100) * 100) / 100;
    this.tdsAmount = Math.round(this.subtotal * (this.tdsRate / 100) * 100) / 100;
    this.total = Math.round((this.subtotal + this.gstAmount - this.tdsAmount) * 100) / 100;
    this.amountInBaseCurrency = Math.round(this.total * this.exchangeRate * 100) / 100;

    // Update status if fully paid
    if (this.paidAmount >= this.total && this.status !== 'cancelled') {
        this.status = 'paid';
    } else if (this.paidAmount > 0 && this.paidAmount < this.total) {
        this.status = 'partial';
    }

    next();
});

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
