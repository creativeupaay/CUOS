import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Sub-interfaces ──────────────────────────────────────────────────

export interface IWorkSchedule {
    workingDaysPerWeek: number;
    hoursPerDay: number;
}

export interface IPersonalInfo {
    dob?: Date;
    gender?: 'male' | 'female' | 'other';
    phone?: string;
    alternatePhone?: string;
    fatherName?: string;
    fatherPhone?: string;
    emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
    };
    bloodGroup?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
    };
}

export interface IBankDetails {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankBranch?: string;
    upiId?: string;
    panNumber?: string;
    taxInfo?: {
        gstNumber?: string;
        tdsRate?: number;
    };
}

export interface IIdentityVerification {
    type?: 'aadhaar' | 'pan' | 'voter' | 'other';
    idNumber?: string;
    documentCloudinaryId?: string;
    documentUrl?: string;
}

export interface IProfilePhoto {
    cloudinaryId?: string;
    url?: string;
}

export interface IOnboardingChecklist {
    item: string;
    completed: boolean;
    completedAt?: Date;
}

export interface IOnboarding {
    status: 'not-started' | 'in-progress' | 'completed';
    checklist: IOnboardingChecklist[];
    startedAt?: Date;
    completedAt?: Date;
}

// ── Main Interface ──────────────────────────────────────────────────

export interface IEmployee extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    employeeId: string;
    designation: string;
    department: 'engineering' | 'design' | 'marketing' | 'finance' | 'hr' | 'admin';
    employmentType: 'full-time' | 'part-time' | 'contract' | 'intern';
    joiningDate: Date;
    probationEndDate?: Date;
    status: 'active' | 'on-notice' | 'relieved' | 'terminated';
    reportingTo?: Types.ObjectId;
    paidLeavesPerYear: number;
    workSchedule: IWorkSchedule;
    personalInfo: IPersonalInfo;
    bankDetails: IBankDetails;
    identityVerification: IIdentityVerification;
    profilePhoto: IProfilePhoto;
    tshirtSize?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
    // Self-onboarding form fields
    formToken?: string;
    formSubmitted: boolean;
    formSubmittedAt?: Date;
    onboarding: IOnboarding;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

// ── Sub-schemas ─────────────────────────────────────────────────────

const WorkScheduleSchema = new Schema<IWorkSchedule>(
    {
        workingDaysPerWeek: { type: Number, default: 5, min: 1, max: 7 },
        hoursPerDay: { type: Number, default: 8, min: 1, max: 24 },
    },
    { _id: false }
);

const PersonalInfoSchema = new Schema<IPersonalInfo>(
    {
        dob: Date,
        gender: { type: String, enum: ['male', 'female', 'other'] },
        phone: { type: String, trim: true },
        alternatePhone: { type: String, trim: true },
        fatherName: { type: String, trim: true },
        fatherPhone: { type: String, trim: true },
        emergencyContact: {
            name: { type: String, trim: true },
            phone: { type: String, trim: true },
            relation: { type: String, trim: true },
        },
        bloodGroup: { type: String, trim: true },
        address: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            country: { type: String, trim: true },
            postalCode: { type: String, trim: true },
        },
    },
    { _id: false }
);

const BankDetailsSchema = new Schema<IBankDetails>(
    {
        bankName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        ifscCode: { type: String, trim: true },
        bankBranch: { type: String, trim: true },
        upiId: { type: String, trim: true },
        panNumber: { type: String, trim: true },
        taxInfo: {
            gstNumber: { type: String, trim: true },
            tdsRate: { type: Number, min: 0, max: 100 },
        },
    },
    { _id: false }
);

const IdentityVerificationSchema = new Schema<IIdentityVerification>(
    {
        type: { type: String, enum: ['aadhaar', 'pan', 'voter', 'other'] },
        idNumber: { type: String, trim: true },
        documentCloudinaryId: { type: String, trim: true },
        documentUrl: { type: String, trim: true },
    },
    { _id: false }
);

const ProfilePhotoSchema = new Schema<IProfilePhoto>(
    {
        cloudinaryId: { type: String, trim: true },
        url: { type: String, trim: true },
    },
    { _id: false }
);

const OnboardingChecklistSchema = new Schema<IOnboardingChecklist>(
    {
        item: { type: String, required: true, trim: true },
        completed: { type: Boolean, default: false },
        completedAt: Date,
    },
    { _id: true }
);

const OnboardingSchema = new Schema<IOnboarding>(
    {
        status: {
            type: String,
            enum: ['not-started', 'in-progress', 'completed'],
            default: 'not-started',
        },
        checklist: [OnboardingChecklistSchema],
        startedAt: Date,
        completedAt: Date,
    },
    { _id: false }
);

// ── Main Schema ─────────────────────────────────────────────────────

const EmployeeSchema = new Schema<IEmployee>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        employeeId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        designation: {
            type: String,
            required: true,
            trim: true,
        },
        department: {
            type: String,
            required: true,
            enum: ['engineering', 'design', 'marketing', 'finance', 'hr', 'admin'],
        },
        employmentType: {
            type: String,
            required: true,
            enum: ['full-time', 'part-time', 'contract', 'intern'],
            default: 'full-time',
        },
        joiningDate: {
            type: Date,
            required: true,
        },
        probationEndDate: Date,
        status: {
            type: String,
            enum: ['active', 'on-notice', 'relieved', 'terminated'],
            default: 'active',
        },
        reportingTo: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
        },
        paidLeavesPerYear: {
            type: Number,
            default: 12,
            min: 0,
            max: 365,
        },
        workSchedule: {
            type: WorkScheduleSchema,
            default: () => ({ workingDaysPerWeek: 5, hoursPerDay: 8 }),
        },
        personalInfo: {
            type: PersonalInfoSchema,
            default: () => ({}),
        },
        bankDetails: {
            type: BankDetailsSchema,
            default: () => ({}),
        },
        identityVerification: {
            type: IdentityVerificationSchema,
            default: () => ({}),
        },
        profilePhoto: {
            type: ProfilePhotoSchema,
            default: () => ({}),
        },
        tshirtSize: {
            type: String,
            enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        },
        formToken: {
            type: String,
            unique: true,
            sparse: true,
            index: true,
        },
        formSubmitted: {
            type: Boolean,
            default: false,
        },
        formSubmittedAt: {
            type: Date,
        },
        onboarding: {
            type: OnboardingSchema,
            default: () => ({ status: 'not-started', checklist: [] }),
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

// Indexes (userId and employeeId already indexed via unique:true on the fields)
EmployeeSchema.index({ department: 1 });
EmployeeSchema.index({ status: 1 });
EmployeeSchema.index({ reportingTo: 1 });
EmployeeSchema.index({ joiningDate: -1 });

export const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema);
