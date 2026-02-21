import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IClientContact {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    isPrimary: boolean;
}

export interface IClientAddress {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
}

export interface IClientBillingDetails {
    billingEmail?: string;
    taxId?: string;
    paymentTerms?: string;
    currency: string;
}

export interface IClientPhone {
    number: string;
    label: string;
}

export interface IClientCustomDetail {
    key: string;
    value: string;
}

export interface IClient extends Document {
    _id: Types.ObjectId;
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
    otherPhones?: IClientPhone[];

    address?: IClientAddress;
    billingDetails?: IClientBillingDetails;
    contacts: IClientContact[];

    leadId?: Types.ObjectId;
    proposalIds: Types.ObjectId[];
    projectDetails?: string;

    status: 'active' | 'inactive' | 'archived';
    registrationType: 'Registered' | 'Unregistered' | 'Overseas';
    gstNumber?: string;
    vatNumber?: string;
    customDetails?: IClientCustomDetail[];
    notes?: string;

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ClientContactSchema = new Schema<IClientContact>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        role: { type: String, trim: true },
        isPrimary: { type: Boolean, default: false },
    },
    { _id: true }
);

const ClientAddressSchema = new Schema<IClientAddress>(
    {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
    },
    { _id: false }
);

const ClientBillingDetailsSchema = new Schema<IClientBillingDetails>(
    {
        billingEmail: { type: String, trim: true, lowercase: true },
        taxId: String,
        paymentTerms: String,
        currency: { type: String, default: 'USD' },
    },
    { _id: false }
);

const ClientSchema = new Schema<IClient>(
    {
        name: { type: String, required: true, trim: true },
        companyName: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        otherPhones: [
            {
                number: { type: String, required: true, trim: true },
                label: { type: String, required: true, trim: true },
            },
        ],

        address: ClientAddressSchema,
        billingDetails: ClientBillingDetailsSchema,
        contacts: [ClientContactSchema],

        leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
        proposalIds: [{ type: Schema.Types.ObjectId, ref: 'Proposal' }],
        projectDetails: { type: String, trim: true },

        status: {
            type: String,
            enum: ['active', 'inactive', 'archived'],
            default: 'active',
        },
        registrationType: {
            type: String,
            enum: ['Registered', 'Unregistered', 'Overseas'],
            default: 'Unregistered',
        },
        gstNumber: { type: String, trim: true },
        vatNumber: { type: String, trim: true },
        customDetails: [
            {
                key: { type: String, required: true, trim: true },
                value: { type: String, required: true, trim: true },
            },
        ],
        notes: { type: String, trim: true },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    {
        timestamps: true,
    }
);

// Indexes for performance
ClientSchema.index({ name: 1 });
ClientSchema.index({ email: 1 });
ClientSchema.index({ status: 1 });
ClientSchema.index({ createdAt: -1 });

// Ensure only one primary contact
ClientSchema.pre('save', function (next) {
    const primaryContacts = this.contacts.filter((c) => c.isPrimary);
    if (primaryContacts.length > 1) {
        // Keep only the first primary contact
        this.contacts.forEach((c, i) => {
            if (i > 0 && c.isPrimary) {
                c.isPrimary = false;
            }
        });
    }
    next();
});

export const Client = mongoose.model<IClient>('Client', ClientSchema);
