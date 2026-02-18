import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPayrollDeductions {
    pf: number;
    esi: number;
    tax: number;
    leaves: number;
    penalties: number;
    other: number;
}

export interface IPayroll extends Document {
    _id: Types.ObjectId;
    employeeId: Types.ObjectId;
    month: number;
    year: number;
    workingDays: number;
    presentDays: number;
    totalHoursWorked: number;
    overtime: number;
    grossSalary: number;
    incentiveAmount: number;
    penaltyAmount: number;
    deductions: IPayrollDeductions;
    netSalary: number;
    status: 'draft' | 'approved' | 'paid';
    generatedBy: Types.ObjectId;
    approvedBy?: Types.ObjectId;
    paidAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PayrollDeductionsSchema = new Schema<IPayrollDeductions>(
    {
        pf: { type: Number, default: 0, min: 0 },
        esi: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        leaves: { type: Number, default: 0, min: 0 },
        penalties: { type: Number, default: 0, min: 0 },
        other: { type: Number, default: 0, min: 0 },
    },
    { _id: false }
);

const PayrollSchema = new Schema<IPayroll>(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        month: { type: Number, required: true, min: 1, max: 12 },
        year: { type: Number, required: true },
        workingDays: { type: Number, required: true, min: 0 },
        presentDays: { type: Number, required: true, min: 0 },
        totalHoursWorked: { type: Number, default: 0, min: 0 },
        overtime: { type: Number, default: 0, min: 0 },
        grossSalary: { type: Number, required: true, min: 0 },
        incentiveAmount: { type: Number, default: 0 },
        penaltyAmount: { type: Number, default: 0, min: 0 },
        deductions: {
            type: PayrollDeductionsSchema,
            default: () => ({ pf: 0, esi: 0, tax: 0, leaves: 0, penalties: 0, other: 0 }),
        },
        netSalary: { type: Number, required: true },
        status: {
            type: String,
            enum: ['draft', 'approved', 'paid'],
            default: 'draft',
        },
        generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        paidAt: Date,
    },
    {
        timestamps: true,
    }
);

// Compound unique: one payroll per employee per month
PayrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
PayrollSchema.index({ status: 1 });
PayrollSchema.index({ year: 1, month: 1 });

export const Payroll = mongoose.model<IPayroll>('Payroll', PayrollSchema);
