import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IExpense extends Document {
    _id: Types.ObjectId;
    date: Date;
    description: string;
    category: string;

    // Classification
    level: 'company' | 'project';
    type: 'fixed' | 'variable';

    // Amount
    amount: number;

    // Project linkage (for project level expenses)
    projectId?: Types.ObjectId;
    projectName?: string;

    // Employee linkage (for salary expenses)
    employeeId?: Types.ObjectId;
    employeeName?: string;
    payrollId?: Types.ObjectId;
    reimbursementId?: Types.ObjectId;

    // Allocation details (for shared employee costs across projects)
    isAllocated?: boolean;
    allocationPercentage?: number;
    totalMonthlyHours?: number;
    projectHours?: number;

    // Vendor & Payment
    vendor?: string;
    paidBy?: string;
    sourceAccountKey?: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
    paymentMethod?: 'cash' | 'bank_transfer' | 'credit_card' | 'upi' | 'cheque';
    transactionRef?: string;
    bankTransactionId?: Types.ObjectId;
    gstClaimable?: boolean;
    gstRate?: number;

    // Recurring
    isRecurring: boolean;
    recurringFrequency?: 'monthly' | 'quarterly' | 'yearly';
    isSynced?: boolean; // For auto-synced expenses from payroll

    // Additional
    notes?: string;
    attachments?: string[];
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
    {
        date: { type: Date, required: true },
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
                'Reimbursements',
                'Other',
            ],
        },

        // Classification
        level: {
            type: String,
            enum: ['company', 'project'],
            default: 'company',
        },
        type: {
            type: String,
            enum: ['fixed', 'variable'],
            default: 'variable',
        },

        // Amount
        amount: { type: Number, required: true, min: 0 },

        // Project linkage
        projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
        projectName: { type: String, trim: true },

        // Employee linkage
        employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
        employeeName: { type: String, trim: true },
        payrollId: { type: Schema.Types.ObjectId, ref: 'Payroll' },
        reimbursementId: { type: Schema.Types.ObjectId, ref: 'Reimbursement' },

        // Allocation details
        isAllocated: { type: Boolean, default: false },
        allocationPercentage: { type: Number, min: 0, max: 100 },
        totalMonthlyHours: { type: Number, min: 0 },
        projectHours: { type: Number, min: 0 },

        // Vendor & Payment
        vendor: { type: String, trim: true },
        paidBy: { type: String, trim: true },
        sourceAccountKey: {
            type: String,
            enum: ['hdfc_gst', 'sbi_non_gst', 'cash'],
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'bank_transfer', 'credit_card', 'upi', 'cheque'],
        },
        transactionRef: { type: String, trim: true },
        bankTransactionId: { type: Schema.Types.ObjectId, ref: 'BankTransaction' },

        // Recurring
        isRecurring: { type: Boolean, default: false },
        recurringFrequency: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly'],
        },
        isSynced: { type: Boolean, default: false },
        gstClaimable: { type: Boolean, default: false },
        gstRate: { type: Number, min: 0 },

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

// Indexes
ExpenseSchema.index({ date: 1 });
ExpenseSchema.index({ level: 1 });
ExpenseSchema.index({ type: 1 });
ExpenseSchema.index({ category: 1 });
ExpenseSchema.index({ projectId: 1 });
ExpenseSchema.index({ employeeId: 1 });
ExpenseSchema.index({ sourceAccountKey: 1 });
ExpenseSchema.index({ createdAt: -1 });
ExpenseSchema.index({ date: 1, level: 1, type: 1 }); // For dashboard queries
ExpenseSchema.index({ payrollId: 1 }, { sparse: true }); // For synced expenses

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
