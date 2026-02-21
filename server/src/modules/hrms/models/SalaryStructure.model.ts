import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISalaryRevision {
    basic: number;
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

export interface ISalaryStructure extends Document {
    _id: Types.ObjectId;
    employeeId: Types.ObjectId;
    basic: number;
    hra: number;
    da: number;
    specialAllowance: number;
    hourlyRate: number;
    deductions: ISalaryDeductions;
    currency: string;
    effectiveFrom: Date;
    revisionHistory: ISalaryRevision[];
    createdAt: Date;
    updatedAt: Date;
}

const SalaryRevisionSchema = new Schema<ISalaryRevision>(
    {
        basic: { type: Number, required: true, min: 0, default: 0 },
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

const SalaryStructureSchema = new Schema<ISalaryStructure>(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
            unique: true,
        },
        basic: { type: Number, required: true, min: 0, default: 0 },
        hra: { type: Number, required: true, min: 0, default: 0 },
        da: { type: Number, default: 0, min: 0 },
        specialAllowance: { type: Number, default: 0, min: 0 },
        hourlyRate: { type: Number, default: 0, min: 0 },
        deductions: {
            type: SalaryDeductionsSchema,
            default: () => ({ pf: 0, esi: 0, tax: 0, other: 0 }),
        },
        currency: { type: String, default: 'INR', trim: true },
        effectiveFrom: { type: Date, required: true },
        revisionHistory: [SalaryRevisionSchema],
    },
    {
        timestamps: true,
    }
);

// Indexes
SalaryStructureSchema.index({ employeeId: 1 });

// Virtual: gross salary
SalaryStructureSchema.virtual('grossSalary').get(function () {
    return this.basic + this.hra + this.da + this.specialAllowance;
});

export const SalaryStructure = mongoose.model<ISalaryStructure>(
    'SalaryStructure',
    SalaryStructureSchema
);
