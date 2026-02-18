import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILeave extends Document {
    _id: Types.ObjectId;
    employeeId: Types.ObjectId;
    type: 'casual' | 'sick' | 'earned' | 'unpaid' | 'maternity' | 'paternity';
    startDate: Date;
    endDate: Date;
    days: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    approvedBy?: Types.ObjectId;
    rejectionReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const LeaveSchema = new Schema<ILeave>(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: ['casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity'],
        },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        days: { type: Number, required: true, min: 0.5 },
        reason: { type: String, required: true, trim: true },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'cancelled'],
            default: 'pending',
        },
        approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        rejectionReason: { type: String, trim: true },
    },
    {
        timestamps: true,
    }
);

// Indexes
LeaveSchema.index({ employeeId: 1 });
LeaveSchema.index({ status: 1 });
LeaveSchema.index({ startDate: 1, endDate: 1 });
LeaveSchema.index({ employeeId: 1, startDate: 1, endDate: 1 });

export const Leave = mongoose.model<ILeave>('Leave', LeaveSchema);
