import mongoose, { Document, Schema, Types } from 'mongoose';

export type BankAccountKey = 'hdfc_gst' | 'sbi_non_gst' | 'cash';
export type BankTransactionType = 'credit' | 'debit';
export type BankTransactionSource = 'manual' | 'automatic';

export interface IBankTransaction extends Document {
    _id: Types.ObjectId;
    bankAccountId?: Types.ObjectId;
    accountKey: BankAccountKey;
    accountName: string;
    transactionType: BankTransactionType;
    amount: number;
    date: Date;
    description: string;
    referenceNumber?: string;
    notes?: string;
    source: BankTransactionSource;
    expenseId?: Types.ObjectId;
    payrollId?: Types.ObjectId;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const BankTransactionSchema = new Schema<IBankTransaction>(
    {
        bankAccountId: { type: Schema.Types.ObjectId, ref: 'BankAccount', index: true },
        accountKey: {
            type: String,
            enum: ['hdfc_gst', 'sbi_non_gst', 'cash'],
            required: true,
            index: true,
        },
        accountName: { type: String, required: true, trim: true },
        transactionType: {
            type: String,
            enum: ['credit', 'debit'],
            required: true,
            index: true,
        },
        amount: { type: Number, required: true, min: 0 },
        date: { type: Date, required: true, index: true },
        description: { type: String, required: true, trim: true },
        referenceNumber: { type: String, trim: true },
        notes: { type: String, trim: true },
        source: {
            type: String,
            enum: ['manual', 'automatic'],
            default: 'manual',
        },
        expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', index: true },
        payrollId: { type: Schema.Types.ObjectId, ref: 'Payroll', index: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
    }
);

BankTransactionSchema.index({ accountKey: 1, date: -1, createdAt: -1 });

export const BankTransaction = mongoose.model<IBankTransaction>('BankTransaction', BankTransactionSchema);
