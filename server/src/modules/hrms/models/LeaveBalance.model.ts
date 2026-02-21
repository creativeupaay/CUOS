import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILeaveBalanceItem {
    type: 'casual' | 'sick' | 'earned' | 'unpaid' | 'maternity' | 'paternity';
    quota: number;
    used: number;
    pending: number;
}

export interface ILeaveBalance extends Document {
    _id: Types.ObjectId;
    employeeId: Types.ObjectId;
    year: number;
    balances: ILeaveBalanceItem[];
    createdAt: Date;
    updatedAt: Date;
}

const LeaveBalanceItemSchema = new Schema<ILeaveBalanceItem>(
    {
        type: {
            type: String,
            required: true,
            enum: ['casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity'],
        },
        quota: { type: Number, required: true, min: 0 },
        used: { type: Number, default: 0, min: 0 },
        pending: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const LeaveBalanceSchema = new Schema<ILeaveBalance>(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        year: { type: Number, required: true },
        balances: [LeaveBalanceItemSchema],
    },
    {
        timestamps: true,
    }
);

// Indexes
LeaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.model<ILeaveBalance>('LeaveBalance', LeaveBalanceSchema);
