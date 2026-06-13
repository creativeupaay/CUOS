import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILeaveBalanceItem {
    type: 'casual' | 'sick' | 'earned' | 'unpaid' | 'maternity' | 'paternity' | 'sabbatical' | 'menstrual' | 'wfh';
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
            enum: ['casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity', 'sabbatical', 'menstrual', 'wfh'],
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

// Pre-validate hook to sanitize negative balances before Mongoose validation
LeaveBalanceSchema.pre('validate', function (next) {
    if (this.balances && Array.isArray(this.balances)) {
        this.balances.forEach((b) => {
            if (b.pending < 0) b.pending = 0;
            if (b.used < 0) b.used = 0;
            if (b.quota < 0) b.quota = 0;
        });
    }
    next();
});

// Indexes
LeaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.model<ILeaveBalance>('LeaveBalance', LeaveBalanceSchema);
