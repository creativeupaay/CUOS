import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Sub-interfaces ────────────────────────────────────────────────────

export type ReimbursementCategory =
    | 'travel'
    | 'meals'
    | 'hotel'
    | 'fuel'
    | 'medical'
    | 'office'
    | 'software'
    | 'other';

export type ReimbursementStatus =
    | 'draft'
    | 'pending'
    | 'approved'
    | 'changes_requested'
    | 'paid'
    | 'rejected';

export interface IReimbursementReceipt {
    cloudinaryId: string;
    url: string;
    format: string;
    size: number;
    originalName?: string;
}

export interface IApprovalStep {
    stage: string;
    status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
    actorId?: Types.ObjectId;
    actorName?: string;
    comment?: string;
    timestamp?: Date;
}

export interface IActivityEntry {
    action: string;
    actorId: Types.ObjectId;
    actorName: string;
    comment?: string;
    timestamp: Date;
}

export interface IPaymentInfo {
    method: 'bank_transfer' | 'upi' | 'cash' | 'cheque';
    reference?: string;
    paidAt: Date;
}

export interface IPolicyFlag {
    rule: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
}

// ── Main Interface ────────────────────────────────────────────────────

export interface IReimbursement extends Document {
    _id: Types.ObjectId;
    claimId: string;
    employeeId: Types.ObjectId;
    title: string;
    category: ReimbursementCategory;
    level: 'company' | 'project';
    projectId?: Types.ObjectId;
    expenseDate: Date;
    amount: number;
    merchant?: string;
    businessPurpose?: string;
    receipt?: IReimbursementReceipt;
    status: ReimbursementStatus;
    approvalTimeline: IApprovalStep[];
    activityLog: IActivityEntry[];
    paymentInfo?: IPaymentInfo;
    policyFlags: IPolicyFlag[];
    submittedAt?: Date;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

// ── Sub-schemas ───────────────────────────────────────────────────────

const ReceiptSchema = new Schema<IReimbursementReceipt>(
    {
        cloudinaryId: { type: String, required: true },
        url: { type: String, required: true },
        format: { type: String, required: true },
        size: { type: Number, required: true },
        originalName: { type: String },
    },
    { _id: false }
);

const ApprovalStepSchema = new Schema<IApprovalStep>(
    {
        stage: { type: String, required: true },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'changes_requested'],
            default: 'pending',
        },
        actorId: { type: Schema.Types.ObjectId, ref: 'User' },
        actorName: { type: String },
        comment: { type: String },
        timestamp: { type: Date },
    },
    { _id: true }
);

const ActivityEntrySchema = new Schema<IActivityEntry>(
    {
        action: { type: String, required: true },
        actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        actorName: { type: String, required: true },
        comment: { type: String },
        timestamp: { type: Date, default: Date.now },
    },
    { _id: true }
);

const PaymentInfoSchema = new Schema<IPaymentInfo>(
    {
        method: {
            type: String,
            enum: ['bank_transfer', 'upi', 'cash', 'cheque'],
            required: true,
        },
        reference: { type: String },
        paidAt: { type: Date, required: true },
    },
    { _id: false }
);

const PolicyFlagSchema = new Schema<IPolicyFlag>(
    {
        rule: { type: String, required: true },
        status: { type: String, enum: ['pass', 'warn', 'fail'], required: true },
        message: { type: String, required: true },
    },
    { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────

const ReimbursementSchema = new Schema<IReimbursement>(
    {
        claimId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            required: true,
            enum: ['travel', 'meals', 'hotel', 'fuel', 'medical', 'office', 'software', 'other'],
        },
        level: {
            type: String,
            enum: ['company', 'project'],
            default: 'company',
        },
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
        },
        expenseDate: {
            type: Date,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        merchant: {
            type: String,
            trim: true,
        },
        businessPurpose: {
            type: String,
            trim: true,
        },
        receipt: {
            type: ReceiptSchema,
        },
        status: {
            type: String,
            enum: ['draft', 'pending', 'approved', 'changes_requested', 'paid', 'rejected'],
            default: 'draft',
        },
        approvalTimeline: {
            type: [ApprovalStepSchema],
            default: () => ([
                { stage: 'Submitted', status: 'pending' },
                { stage: 'HR / Admin Approval', status: 'pending' },
                { stage: 'Payment', status: 'pending' },
            ]),
        },
        activityLog: {
            type: [ActivityEntrySchema],
            default: () => ([]),
        },
        paymentInfo: {
            type: PaymentInfoSchema,
        },
        policyFlags: {
            type: [PolicyFlagSchema],
            default: () => ([]),
        },
        submittedAt: {
            type: Date,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
ReimbursementSchema.index({ employeeId: 1, status: 1 });
ReimbursementSchema.index({ status: 1 });
ReimbursementSchema.index({ expenseDate: -1 });
ReimbursementSchema.index({ submittedAt: -1 });
ReimbursementSchema.index({ category: 1 });

export const Reimbursement = mongoose.model<IReimbursement>('Reimbursement', ReimbursementSchema);
