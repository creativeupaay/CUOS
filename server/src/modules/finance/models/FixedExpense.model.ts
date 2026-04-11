import mongoose, { Document, Schema, Types } from 'mongoose';
import type { BankAccountKey } from './BankTransaction.model';

export type FixedExpenseFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface IFixedExpense extends Document {
    _id: Types.ObjectId;
    title: string;
    description: string;
    category: string;
    level: 'company' | 'project';
    type: 'fixed';
    amount: number;
    dueDay: number;
    frequency: FixedExpenseFrequency;
    startDate: Date;
    projectId?: Types.ObjectId;
    projectName?: string;
    vendor?: string;
    paidBy?: string;
    sourceAccountKey?: BankAccountKey;
    notes?: string;
    isActive: boolean;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const FixedExpenseSchema = new Schema<IFixedExpense>(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        category: {
            type: String,
            required: true,
            trim: true,
            enum: [
                'Salaries',
                'Rent',
                'Utilities',
                'Cloud Services',
                'Software Licenses',
                'Marketing',
                'HR & Culture',
                'Infrastructure',
                'Travel',
                'Office Supplies',
                'Professional Services',
                'Internet & Communication',
                'Insurance',
                'Legal & Compliance',
                'GST Payment',
                'TDS Payment',
                'Other',
            ],
        },
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
        dueDay: { type: Number, required: true, min: 1, max: 31 },
        frequency: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly'],
            default: 'monthly',
        },
        startDate: { type: Date, required: true },
        projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
        projectName: { type: String, trim: true },
        vendor: { type: String, trim: true },
        paidBy: { type: String, trim: true },
        sourceAccountKey: {
            type: String,
            enum: ['hdfc_gst', 'sbi_non_gst', 'cash'],
        },
        notes: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
    }
);

FixedExpenseSchema.index({ isActive: 1, frequency: 1, dueDay: 1 });
FixedExpenseSchema.index({ category: 1, level: 1 });
FixedExpenseSchema.index({ createdAt: -1 });

export const FixedExpense = mongoose.model<IFixedExpense>('FixedExpense', FixedExpenseSchema);
