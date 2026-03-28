import mongoose, { Document, Schema } from 'mongoose';
import type { JobApplicationFieldType } from '../../hiring/models/Job.model';

export interface IHiringApplicationFieldLibraryItem {
    key: string;
    label: string;
    type: JobApplicationFieldType;
    placeholder?: string;
    helpText?: string;
    createdAt?: Date;
}

export interface IOrgSettings extends Document {
    companyName: string;
    companyEmail: string;
    companyPhone?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        zipCode?: string;
    };
    departments: string[];
    currency: string;
    taxSettings: {
        gstEnabled: boolean;
        gstRate: number;
        tdsEnabled: boolean;
        tdsRate: number;
    };
    workingHours: {
        startTime: string;
        endTime: string;
        daysPerWeek: number;
        hoursPerDay: number;
    };
    featureToggles: {
        projectManagement: boolean;
        finance: boolean;
        crm: boolean;
        hrms: boolean;
        leads: boolean;
    };
    hiring: {
        applicationFieldLibrary: IHiringApplicationFieldLibraryItem[];
    };
    passwordPolicy: {
        minLength: number;
        requireUppercase: boolean;
        requireLowercase: boolean;
        requireNumbers: boolean;
        requireSpecialChars: boolean;
    };
    sessionExpiryMinutes: number;
    createdAt: Date;
    updatedAt: Date;
}

const HiringApplicationFieldLibraryItemSchema = new Schema<IHiringApplicationFieldLibraryItem>(
    {
        key: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ['text', 'url', 'number', 'note', 'date', 'attachment'],
            required: true,
        },
        placeholder: { type: String, trim: true },
        helpText: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const OrgSettingsSchema = new Schema<IOrgSettings>(
    {
        companyName: {
            type: String,
            required: true,
            default: 'Creative Upaay',
            trim: true,
        },
        companyEmail: {
            type: String,
            required: true,
            default: 'admin@creativeupaay.com',
            trim: true,
            lowercase: true,
        },
        companyPhone: {
            type: String,
            trim: true,
        },
        address: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            country: { type: String, trim: true, default: 'India' },
            zipCode: { type: String, trim: true },
        },
        departments: {
            type: [String],
            default: ['Engineering', 'Design', 'Marketing', 'Finance', 'HR', 'Operations', 'Creative'],
        },
        currency: {
            type: String,
            default: 'INR',
            trim: true,
            uppercase: true,
        },
        taxSettings: {
            gstEnabled: { type: Boolean, default: true },
            gstRate: { type: Number, default: 18 },
            tdsEnabled: { type: Boolean, default: true },
            tdsRate: { type: Number, default: 10 },
        },
        workingHours: {
            startTime: { type: String, default: '09:00' },
            endTime: { type: String, default: '18:00' },
            daysPerWeek: { type: Number, default: 5 },
            hoursPerDay: { type: Number, default: 8 },
        },
        featureToggles: {
            projectManagement: { type: Boolean, default: true },
            finance: { type: Boolean, default: false },
            crm: { type: Boolean, default: true },
            hrms: { type: Boolean, default: true },
            leads: { type: Boolean, default: true },
        },
        hiring: {
            applicationFieldLibrary: {
                type: [HiringApplicationFieldLibraryItemSchema],
                default: [],
            },
        },
        passwordPolicy: {
            minLength: { type: Number, default: 8 },
            requireUppercase: { type: Boolean, default: true },
            requireLowercase: { type: Boolean, default: true },
            requireNumbers: { type: Boolean, default: true },
            requireSpecialChars: { type: Boolean, default: false },
        },
        sessionExpiryMinutes: {
            type: Number,
            default: 15,
        },
    },
    {
        timestamps: true,
    }
);

export const OrgSettings = mongoose.model<IOrgSettings>('OrgSettings', OrgSettingsSchema);
