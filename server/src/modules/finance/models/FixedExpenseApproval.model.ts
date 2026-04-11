import mongoose, { Document, Schema, Types } from 'mongoose';
import type { FixedExpenseFrequency } from './FixedExpense.model';
import type { BankAccountKey } from './BankTransaction.model';

export type FixedExpenseApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface IFixedExpenseApproval extends Document {
    _id: Types.ObjectId;
    fixedExpenseId: Types.ObjectId;
    periodKey: string;
    dueDate: Date;
    status: FixedExpenseApprovalStatus;
    title: string;
    description: string;
    category: string;
    level: 'company' | 'project';
    type: 'fixed';
    amount: number;
    frequency: FixedExpenseFrequency;
    dueDay: number;
    projectId?: Types.ObjectId;
    projectName?: string;
    vendor?: string;
    paidBy?: string;
    sourceAccountKey?: BankAccountKey;
    notes?: string;
    responseNotes?: string;
    paidDate?: Date;
    approvedExpenseId?: Types.ObjectId;
    actedBy?: Types.ObjectId;
    actedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const FixedExpenseApprovalSchema = new Schema<IFixedExpenseApproval>(
    {
        fixedExpenseId: { type: Schema.Types.ObjectId, ref: 'FixedExpense', required: true },
        periodKey: { type: String, required: true, trim: true },
        dueDate: { type: Date, required: true },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        category: { type: String, required: true, trim: true },
        level: {
            type: String,
            enum: ['company', 'project'],
            default: 'company',
        },
        type: {
            type: String,
            enum: ['fixed'],
            default: 'fixed',
        },
        amount: { type: Number, required: true, min: 0 },
        frequency: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly'],
            required: true,
        },
        dueDay: { type: Number, required: true, min: 1, max: 31 },
        projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
        projectName: { type: String, trim: true },
        vendor: { type: String, trim: true },
        paidBy: { type: String, trim: true },
        sourceAccountKey: {
            type: String,
            enum: ['hdfc_gst', 'sbi_non_gst', 'cash'],
        },
        notes: { type: String, trim: true },
        responseNotes: { type: String, trim: true },
        paidDate: { type: Date },
        approvedExpenseId: { type: Schema.Types.ObjectId, ref: 'Expense' },
        actedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        actedAt: { type: Date },
    },
    {
        timestamps: true,
    }
);

FixedExpenseApprovalSchema.index({ fixedExpenseId: 1, periodKey: 1 }, { unique: true });
FixedExpenseApprovalSchema.index({ status: 1, dueDate: 1 });
FixedExpenseApprovalSchema.index({ createdAt: -1 });

export const FixedExpenseApproval = mongoose.model<IFixedExpenseApproval>(
    'FixedExpenseApproval',
    FixedExpenseApprovalSchema
);
