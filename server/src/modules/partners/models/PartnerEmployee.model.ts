import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IPartnerEmployee extends Document {
    _id: Types.ObjectId;
    partnerId: Types.ObjectId;
    name: string;
    email: string;
    password: string;
    phone?: string;
    designation?: string;
    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const PartnerEmployeeSchema = new Schema<IPartnerEmployee>(
    {
        partnerId: {
            type: Schema.Types.ObjectId,
            ref: 'Partner',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
            select: false,
        },
        phone: {
            type: String,
            trim: true,
        },
        designation: {
            type: String,
            trim: true,
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

// Hash password before saving
PartnerEmployeeSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
PartnerEmployeeSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

// Index for performance
PartnerEmployeeSchema.index({ partnerId: 1, email: 1 });

export const PartnerEmployee = mongoose.model<IPartnerEmployee>(
    'PartnerEmployee',
    PartnerEmployeeSchema
);
