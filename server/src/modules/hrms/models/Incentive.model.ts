import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IIncentive extends Document {
    _id: Types.ObjectId;
    employeeId: Types.ObjectId;
    taskId?: Types.ObjectId;
    projectId?: Types.ObjectId;
    month: number;
    year: number;
    type: 'bonus' | 'penalty';
    score: number;
    amount: number;
    reason: string;
    calculatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const IncentiveSchema = new Schema<IIncentive>(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        taskId: {
            type: Schema.Types.ObjectId,
            ref: 'Task',
        },
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
        },
        month: { type: Number, required: true, min: 1, max: 12 },
        year: { type: Number, required: true },
        type: {
            type: String,
            required: true,
            enum: ['bonus', 'penalty'],
        },
        score: { type: Number, required: true },
        amount: { type: Number, required: true },
        reason: { type: String, required: true, trim: true },
        calculatedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
    }
);

// Indexes
IncentiveSchema.index({ employeeId: 1 });
IncentiveSchema.index({ employeeId: 1, month: 1, year: 1 });
IncentiveSchema.index({ taskId: 1 });
IncentiveSchema.index({ type: 1 });

export const Incentive = mongoose.model<IIncentive>('Incentive', IncentiveSchema);
