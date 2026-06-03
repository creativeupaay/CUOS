import mongoose, { Schema, Document, Types } from 'mongoose';

export type SalaryPayoutAccountKey = 'hdfc_gst' | 'sbi_non_gst' | 'cash';
export type CompensationType = 'salary' | 'stipend' | 'contract';
export type SalaryType = 'yearly' | 'monthly';

export interface ISalaryRevision {
    basic: number;
    payoutAccountKey: SalaryPayoutAccountKey;
    hra: number;
    da: number;
    specialAllowance: number;
    hourlyRate: number;
    effectiveFrom: Date;
    revisedBy: Types.ObjectId;
}

export interface ISalaryDeductions {
    pf: number;
    esi: number;
    tax: number;
    other: number;
}

export interface IMonthlyEntry {
    month: number; // 1-12
    year: number;
    amount: number;
    paymentDate: string; // ISO date string e.g. "2025-08-01"
}

export interface IAdditionalCompensation {
    name: string;
    amount: number;
    redeemableOn: Date;
    isVariable: boolean;
}

export interface ISalaryStructure extends Document {
    _id: Types.ObjectId;
    employeeId: Types.ObjectId;
    // Salary type & compensation type
    salaryType: SalaryType;
    compensationType: CompensationType;
    // Yearly fields
    basic: number;
    payoutAccountKey: SalaryPayoutAccountKey;
    hra: number;
    da: number;
    specialAllowance: number;
    hourlyRate: number;
    annualAmount: number;
    effectiveFrom: Date;
    firstSalaryDate: Date | null;
    // Monthly fields
    monthlySchedule: IMonthlyEntry[];
    // Additional compensation
    additionalCompensations: IAdditionalCompensation[];
    // Draft
    isDraft: boolean;
    // Deductions & meta
    deductions: ISalaryDeductions;
    currency: string;
    revisionHistory: ISalaryRevision[];
    createdAt: Date;
    updatedAt: Date;
}

const SalaryRevisionSchema = new Schema<ISalaryRevision>(
    {
        basic: { type: Number, required: true, min: 0, default: 0 },
        payoutAccountKey: {
            type: String,
            enum: ['hdfc_gst', 'sbi_non_gst', 'cash'],
            required: true,
            default: 'hdfc_gst',
        },
        hra: { type: Number, required: true, min: 0, default: 0 },
        da: { type: Number, default: 0, min: 0 },
        specialAllowance: { type: Number, default: 0, min: 0 },
        hourlyRate: { type: Number, default: 0, min: 0 },
        effectiveFrom: { type: Date, required: true },
        revisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { _id: true, timestamps: true }
);

const SalaryDeductionsSchema = new Schema<ISalaryDeductions>(
    {
        pf: { type: Number, default: 0, min: 0 },
        esi: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        other: { type: Number, default: 0, min: 0 },
    },
    { _id: false }
);

const MonthlyEntrySchema = new Schema<IMonthlyEntry>(
    {
        month: { type: Number, required: true, min: 1, max: 12 },
        year: { type: Number, required: true },
        amount: { type: Number, required: true, min: 0 },
        paymentDate: { type: String, required: true },
    },
    { _id: false }
);

const AdditionalCompensationSchema = new Schema<IAdditionalCompensation>(
    {
        name: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
        redeemableOn: { type: Date, required: true },
        isVariable: { type: Boolean, default: true },
    },
    { _id: true }
);

const SalaryStructureSchema = new Schema<ISalaryStructure>(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
            unique: true,
        },
        salaryType: {
            type: String,
            enum: ['yearly', 'monthly'],
            default: 'yearly',
        },
        compensationType: {
            type: String,
            enum: ['salary', 'stipend', 'contract'],
            default: 'salary',
        },
        basic: { type: Number, required: false, min: 0, default: 0 },
        payoutAccountKey: {
            type: String,
            enum: ['hdfc_gst', 'sbi_non_gst', 'cash'],
            default: 'hdfc_gst',
            required: true,
        },
        hra: { type: Number, required: false, min: 0, default: 0 },
        da: { type: Number, default: 0, min: 0 },
        specialAllowance: { type: Number, default: 0, min: 0 },
        hourlyRate: { type: Number, default: 0, min: 0 },
        annualAmount: { type: Number, default: 0, min: 0 },
        effectiveFrom: { type: Date, required: false },
        firstSalaryDate: { type: Date, default: null },
        monthlySchedule: { type: [MonthlyEntrySchema], default: [] },
        additionalCompensations: { type: [AdditionalCompensationSchema], default: [] },
        isDraft: { type: Boolean, default: false },
        deductions: {
            type: SalaryDeductionsSchema,
            default: () => ({ pf: 0, esi: 0, tax: 0, other: 0 }),
        },
        currency: { type: String, default: 'INR', trim: true },
        revisionHistory: [SalaryRevisionSchema],
    },
    {
        timestamps: true,
    }
);

// Virtual: gross salary
SalaryStructureSchema.virtual('grossSalary').get(function () {
    return this.basic + this.specialAllowance;
});

export const SalaryStructure = mongoose.model<ISalaryStructure>(
    'SalaryStructure',
    SalaryStructureSchema
);
