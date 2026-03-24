import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPartnerAddress {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
}

export interface IPartner extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId; // Reference to User model
    companyName?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: IPartnerAddress;

    // Registration form fields
    registrationToken?: string;
    registrationTokenExpiry?: Date;
    registrationStatus: 'pending' | 'completed';
    registrationSubmittedAt?: Date;

    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const PartnerAddressSchema = new Schema<IPartnerAddress>(
    {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true },
        postalCode: { type: String, trim: true },
    },
    { _id: false }
);

const PartnerSchema = new Schema<IPartner>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        companyName: {
            type: String,
            trim: true,
        },
        contactPerson: {
            type: String,
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        address: PartnerAddressSchema,

        // Registration token for partner self-registration
        registrationToken: {
            type: String,
            unique: true,
            sparse: true,
            index: true,
        },
        registrationTokenExpiry: {
            type: Date,
        },
        registrationStatus: {
            type: String,
            enum: ['pending', 'completed'],
            default: 'pending',
        },
        registrationSubmittedAt: {
            type: Date,
        },

        isActive: {
            type: Boolean,
            default: true,
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

// Indexes for performance
PartnerSchema.index({ email: 1 });
PartnerSchema.index({ isActive: 1 });
PartnerSchema.index({ createdAt: -1 });

export const Partner = mongoose.model<IPartner>('Partner', PartnerSchema);
