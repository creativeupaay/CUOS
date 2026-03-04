import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IHoliday extends Document {
    _id: Types.ObjectId;
    name: string;
    date: Date;
    type: 'holiday' | 'half-day' | 'wfh';
    description?: string;
    isPaid: boolean;
    affectedEmployees: 'all' | Types.ObjectId[];
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const HolidaySchema = new Schema<IHoliday>(
    {
        name: { type: String, required: true, trim: true },
        date: { type: Date, required: true },
        type: {
            type: String,
            required: true,
            enum: ['holiday', 'half-day', 'wfh'],
            default: 'holiday',
        },
        description: { type: String, trim: true },
        isPaid: { type: Boolean, default: true },
        // 'all' means all active employees, or a list of specific employee IDs
        affectedEmployees: {
            type: Schema.Types.Mixed,
            default: 'all',
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
);

HolidaySchema.index({ date: 1 });
HolidaySchema.index({ date: 1, type: 1 });

export const Holiday = mongoose.model<IHoliday>('Holiday', HolidaySchema);
