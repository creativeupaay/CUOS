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
    userId?: Types.ObjectId; // Reference to User model after onboarding is completed
    slug: string; // Unique slug for personalized login URL
    companyName?: string;
    companyLogo?: string; // URL of company logo
    contactPerson?: string;
    contactPersonPhone?: string;
    phone?: string;
    email?: string;
    photo?: string; // URL of partner's photo
    websiteLink?: string;
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
            unique: true,
            sparse: true,
        },
        slug: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true,
            index: true,
        },
        companyName: {
            type: String,
            trim: true,
        },
        companyLogo: {
            type: String,
            trim: true,
        },
        contactPerson: {
            type: String,
            trim: true,
        },
        contactPersonPhone: {
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
        photo: {
            type: String,
            trim: true,
        },
        websiteLink: {
            type: String,
            trim: true,
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
PartnerSchema.index({ slug: 1 });

export const Partner = mongoose.model<IPartner>('Partner', PartnerSchema);
