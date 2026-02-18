import mongoose, { Schema, Document, Types } from 'mongoose';

export type MilestoneStatus = 'pending' | 'completed' | 'invoiced' | 'paid';

export interface IPaymentMilestone extends Document {
    _id: Types.ObjectId;
    projectId: Types.ObjectId;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    exchangeRate: number;
    amountInBaseCurrency: number;
    dueDate?: Date;
    status: MilestoneStatus;
    completedAt?: Date;   // Accrual date — when work was done
    paidAt?: Date;        // Cash date — when payment received
    invoiceId?: Types.ObjectId;
    notes?: string;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const PaymentMilestoneSchema = new Schema<IPaymentMilestone>(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'INR', trim: true, uppercase: true },
        exchangeRate: { type: Number, default: 1, min: 0 },
        amountInBaseCurrency: { type: Number, default: 0, min: 0 },
        dueDate: Date,
        status: {
            type: String,
            enum: ['pending', 'completed', 'invoiced', 'paid'],
            default: 'pending',
        },
        completedAt: Date,
        paidAt: Date,
        invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
        notes: { type: String, trim: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// Indexes
PaymentMilestoneSchema.index({ projectId: 1 });
PaymentMilestoneSchema.index({ status: 1 });
PaymentMilestoneSchema.index({ dueDate: 1 });

// Auto-compute base currency amount
PaymentMilestoneSchema.pre('save', function (next) {
    this.amountInBaseCurrency = Math.round(this.amount * this.exchangeRate * 100) / 100;
    next();
});

export const PaymentMilestone = mongoose.model<IPaymentMilestone>(
    'PaymentMilestone',
    PaymentMilestoneSchema
);
