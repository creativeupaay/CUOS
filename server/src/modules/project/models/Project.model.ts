import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProjectPhase {
    name: string;
    status: 'pending' | 'in-progress' | 'completed';
    startDate?: Date;
    endDate?: Date;
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
    employeeId: Types.ObjectId;
    role: 'manager' | 'developer' | 'designer' | 'qa' | 'viewer' | 'member';
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
        employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
        role: {
            type: String,
            enum: ['manager', 'developer', 'designer', 'qa', 'viewer', 'member'],
            required: true,
        },
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

        invoiceDetails: InvoiceDetailsSchema,

        documents: [ProjectDocumentSchema],

        assignees: [ProjectAssigneeSchema],

        phases: [ProjectPhaseSchema],

        credentialAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }],

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
