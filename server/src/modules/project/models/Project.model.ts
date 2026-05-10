import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProjectPhase {
    _id?: Types.ObjectId;
    name: string;
    status: 'pending' | 'in-progress' | 'completed';
    startDate?: Date;
    endDate?: Date;

    // Payment tracking
    hasPayment: boolean; // Whether this phase has a payment
    paymentAmount?: number; // Fixed payment amount
    paymentPercentage?: number; // Percentage of project budget
    paymentCurrency?: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
    paymentStatus?: 'pending' | 'received' | 'partial';
    paymentReceivedAmount?: number; // Actual amount received
    paymentDueDate?: Date; // Expected payment date
    paymentBankAccount?: 'hdfc_gst' | 'sbi_non_gst' | 'cash'; // Bank account for this payment
    paymentExpectedAmountINR?: number;
    paymentReceivedAmountINR?: number;
    paymentExchangeRate?: number;
    paymentExchangeRateDate?: Date;
    paymentSettlementCurrency?: 'INR';
    paymentFxRateSource?: 'exact-provider' | 'exact-cache' | 'manual' | 'latest-known';
    paymentFxRequestedDate?: Date;
    paymentFxFallbackUsed?: boolean;

    // Finance integration
    revenueId?: Types.ObjectId; // Link to Revenue entry
    bankTransactionId?: Types.ObjectId; // Link to BankTransaction entry

    // GST and TDS
    gstApplicable?: boolean;
    isGstInclusive?: boolean;
    gstRate?: number;
    tdsPercentage?: number;
    tdsDeducted?: number;

    // Discrepancy tracking
    fxFeesINR?: number;
    adjustmentAmountINR?: number;

    completedAt?: Date; // When the phase was marked as completed
}

export interface IProjectDocument {
    _id: Types.ObjectId;
    name: string;
    type: string;
    cloudinaryId: string;
    uploadedBy: Types.ObjectId;
    uploadedAt: Date;
    size: number;
}

export interface IProjectAssignee {
    employeeId?: Types.ObjectId;
    partnerEmployeeId?: Types.ObjectId;
    partnerId?: Types.ObjectId;
    memberType: 'employee' | 'partner-employee' | 'partner';
    userId?: Types.ObjectId;
    role: 'admin' | 'manager' | 'developer' | 'designer' | 'qa' | 'viewer' | 'member';
    isSystemManaged?: boolean;
    assignedAt: Date;
    assignedBy: Types.ObjectId;
}

export interface IInvoiceDetails {
    invoiceNumber?: string;
    invoiceDate?: Date;
    invoiceAmount?: number;
    paymentStatus?: 'pending' | 'partial' | 'paid';
    paymentTerms?: string;
}

export interface IProject extends Document {
    _id: Types.ObjectId;
    name: string;
    description?: string;
    status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'critical';

    clientId: Types.ObjectId;

    startDate: Date;
    endDate?: Date;
    deadline?: Date;

    budget?: number;
    currency: string;
    billingType: 'fixed' | 'hourly' | 'milestone';
    hourlyRate?: number;
    defaultBankAccount?: 'hdfc_gst' | 'sbi_non_gst' | 'cash';

    invoiceDetails?: IInvoiceDetails;

    documents: IProjectDocument[];

    assignees: IProjectAssignee[];

    phases: IProjectPhase[];

    /**
     * Users who have full edit access to all credentials in this project.
     * These are the "Credential Admins" — they can see, edit, add, delete
     * credentials and manage view-only access for others.
     */
    credentialAdmins: Types.ObjectId[];

    /**
     * Users who have full edit access to all documents in this project.
     * These are the "Document Admins" — they can upload, delete, create folders,
     * and manage view-only access for others.
     */
    docAdmins: Types.ObjectId[];

    // Partner reference - tracks which partner created this project
    partnerId?: Types.ObjectId;

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    isArchived: boolean;
}

const ProjectDocumentSchema = new Schema<IProjectDocument>(
    {
        name: { type: String, required: true },
        type: {
            type: String,
            enum: ['contract', 'proposal', 'invoice', 'other'],
            required: true,
        },
        cloudinaryId: { type: String, required: true },
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        uploadedAt: { type: Date, default: Date.now },
        size: { type: Number, required: true },
    },
    { _id: true }
);

const ProjectAssigneeSchema = new Schema<IProjectAssignee>(
    {
        employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
        partnerEmployeeId: { type: Schema.Types.ObjectId, ref: 'PartnerEmployee' },
        partnerId: { type: Schema.Types.ObjectId, ref: 'Partner' },
        memberType: {
            type: String,
            enum: ['employee', 'partner-employee', 'partner'],
            required: true,
        },
        userId: { type: Schema.Types.ObjectId },
        role: {
            type: String,
            enum: ['admin', 'manager', 'developer', 'designer', 'qa', 'viewer', 'member'],
            required: true,
        },
        isSystemManaged: { type: Boolean, default: false },
        assignedAt: { type: Date, default: Date.now },
        assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { _id: false }
);

const InvoiceDetailsSchema = new Schema<IInvoiceDetails>(
    {
        invoiceNumber: String,
        invoiceDate: Date,
        invoiceAmount: Number,
        paymentStatus: {
            type: String,
            enum: ['pending', 'partial', 'paid'],
        },
        paymentTerms: String,
    },
    { _id: false }
);

const ProjectPhaseSchema = new Schema<IProjectPhase>(
    {
        name: { type: String, required: true },
        status: {
            type: String,
            enum: ['pending', 'in-progress', 'completed'],
            default: 'pending',
        },
        startDate: Date,
        endDate: Date,

        // Payment tracking
        hasPayment: { type: Boolean, default: false },
        paymentAmount: { type: Number, min: 0 },
        paymentPercentage: { type: Number, min: 0, max: 100 },
        paymentCurrency: {
            type: String,
            enum: ['INR', 'USD', 'EUR', 'GBP', 'AED'],
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'received', 'partial'],
            default: 'pending',
        },
        paymentReceivedAmount: { type: Number, default: 0, min: 0 },
        paymentDueDate: Date,
        paymentBankAccount: {
            type: String,
            enum: ['hdfc_gst', 'sbi_non_gst', 'cash'],
        },
        paymentExpectedAmountINR: { type: Number, min: 0 },
        paymentReceivedAmountINR: { type: Number, min: 0 },
        paymentExchangeRate: { type: Number, min: 0 },
        paymentExchangeRateDate: Date,
        paymentSettlementCurrency: {
            type: String,
            enum: ['INR'],
            default: 'INR',
        },
        paymentFxRateSource: {
            type: String,
            enum: ['exact-provider', 'exact-cache', 'manual', 'latest-known'],
        },
        paymentFxRequestedDate: Date,
        paymentFxFallbackUsed: { type: Boolean, default: false },

        // Finance integration
        revenueId: { type: Schema.Types.ObjectId, ref: 'Revenue' },
        bankTransactionId: { type: Schema.Types.ObjectId, ref: 'BankTransaction' },

        // GST and TDS
        gstApplicable: { type: Boolean, default: true },
        isGstInclusive: { type: Boolean, default: false },
        gstRate: { type: Number, default: 18, enum: [0, 5, 12, 18, 28] },
        tdsPercentage: { type: Number, default: 0 },
        tdsDeducted: { type: Number, default: 0, min: 0 },

        // Discrepancy tracking
        fxFeesINR: { type: Number, default: 0 },
        adjustmentAmountINR: { type: Number, default: 0 },

        completedAt: Date,
    },
    { _id: true }
);

const ProjectSchema = new Schema<IProject>(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        status: {
            type: String,
            enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
            default: 'planning',
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
        },

        clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },

        startDate: { type: Date, required: true },
        endDate: Date,
        deadline: Date,

        budget: Number,
        currency: { type: String, default: 'USD' },
        billingType: {
            type: String,
            enum: ['fixed', 'hourly', 'milestone'],
            default: 'fixed',
        },
        hourlyRate: Number,
        defaultBankAccount: {
            type: String,
            enum: ['hdfc_gst', 'sbi_non_gst', 'cash'],
        },

        invoiceDetails: InvoiceDetailsSchema,

        documents: [ProjectDocumentSchema],

        assignees: [ProjectAssigneeSchema],

        phases: [ProjectPhaseSchema],

        credentialAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }],

        docAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }],

        // Partner reference - tracks which partner created this project
        partnerId: { type: Schema.Types.ObjectId, ref: 'Partner' },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        isArchived: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

// Indexes for performance
ProjectSchema.index({ clientId: 1 });
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ 'assignees.employeeId': 1 });
ProjectSchema.index({ 'assignees.partnerEmployeeId': 1 });
ProjectSchema.index({ 'assignees.partnerId': 1 });
ProjectSchema.index({ 'assignees.userId': 1 });
ProjectSchema.index({ partnerId: 1 });
ProjectSchema.index({ createdAt: -1 });
ProjectSchema.index({ isArchived: 1 });

// Virtual for total logged hours (will be calculated from TimeLogs)
ProjectSchema.virtual('totalLoggedHours', {
    ref: 'TimeLog',
    localField: '_id',
    foreignField: 'projectId',
    count: false,
});

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
