import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Expense Categories ──────────────────────────────────────────────
export type ExpenseCategory =
    | 'salary'
    | 'fixed'
    | 'cac'
    | 'project'
    | 'overhead'
    | 'tax'
    | 'transaction-fee'
    | 'currency-loss';

export type ExpenseStatus = 'pending' | 'approved' | 'paid' | 'rejected';

// ── Interface ───────────────────────────────────────────────────────
export interface IExpense extends Document {
    _id: Types.ObjectId;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    exchangeRate: number;
    amountInBaseCurrency: number;
    category: ExpenseCategory;
    projectId?: Types.ObjectId;
    employeeId?: Types.ObjectId;
    date: Date;
    recurring: boolean;
    recurringFrequency?: 'monthly' | 'quarterly' | 'yearly';
    gstApplicable: boolean;
    gstAmount: number;
    tdsApplicable: boolean;
    tdsAmount: number;
    status: ExpenseStatus;
    approvedBy?: Types.ObjectId;
    approvedAt?: Date;
    notes?: string;
    attachments?: string[];
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const ExpenseSchema = new Schema<IExpense>(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'INR', trim: true, uppercase: true },
        exchangeRate: { type: Number, default: 1, min: 0 },
        amountInBaseCurrency: { type: Number, required: true, min: 0 },
        category: {
            type: String,
            required: true,
            enum: [
                'salary',
                'fixed',
                'cac',
                'project',
                'overhead',
                'tax',
                'transaction-fee',
                'currency-loss',
            ],
        },
        projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
        employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
        date: { type: Date, required: true },
        recurring: { type: Boolean, default: false },
        recurringFrequency: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly'],
        },
        gstApplicable: { type: Boolean, default: false },
        gstAmount: { type: Number, default: 0, min: 0 },
        tdsApplicable: { type: Boolean, default: false },
        tdsAmount: { type: Number, default: 0, min: 0 },
        status: {
            type: String,
            enum: ['pending', 'approved', 'paid', 'rejected'],
            default: 'pending',
        },
        approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        approvedAt: Date,
        notes: { type: String, trim: true },
        attachments: [{ type: String }],
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────────────────
ExpenseSchema.index({ category: 1 });
ExpenseSchema.index({ projectId: 1 });
ExpenseSchema.index({ date: -1 });
ExpenseSchema.index({ status: 1 });
ExpenseSchema.index({ category: 1, date: -1 }); // For monthly expense reports
ExpenseSchema.index({ createdBy: 1 });

// Auto-compute amountInBaseCurrency before save
ExpenseSchema.pre('save', function (next) {
    this.amountInBaseCurrency = Math.round(this.amount * this.exchangeRate * 100) / 100;
    next();
});

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
