import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBankAccount extends Document {
    _id: Types.ObjectId;
    accountKey?: 'hdfc_gst' | 'sbi_non_gst' | 'cash'; // Key for quick lookup
    accountName: string;
    bankName: string;
    accountNumber: string;
    ifscCode?: string;
    swiftCode?: string;
    accountType: 'current' | 'savings' | 'cash';
    currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
    currentBalance: number;
    isActive: boolean;
    isPrimary: boolean;
    notes?: string;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const BankAccountSchema = new Schema<IBankAccount>(
    {
        accountKey: {
            type: String,
            enum: ['hdfc_gst', 'sbi_non_gst', 'cash'],
            unique: true,
            sparse: true,
        },
        accountName: { type: String, required: true, trim: true },
        bankName: { type: String, required: true, trim: true },
        accountNumber: { type: String, required: true, trim: true },
        ifscCode: { type: String, trim: true },
        swiftCode: { type: String, trim: true },
        accountType: {
            type: String,
            enum: ['current', 'savings', 'cash'],
            default: 'current',
        },
        currency: {
            type: String,
            enum: ['INR', 'USD', 'EUR', 'GBP', 'AED'],
            default: 'INR',
        },
        currentBalance: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        isPrimary: { type: Boolean, default: false },
        notes: { type: String, trim: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
    }
);

BankAccountSchema.index({ accountKey: 1 });
BankAccountSchema.index({ isActive: 1 });
BankAccountSchema.index({ isPrimary: 1 });

export const BankAccount = mongoose.model<IBankAccount>('BankAccount', BankAccountSchema);
