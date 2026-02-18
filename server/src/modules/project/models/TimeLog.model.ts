import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITimeLog extends Document {
    _id: Types.ObjectId;
    projectId: Types.ObjectId;
    taskId: Types.ObjectId;
    userId: Types.ObjectId;

    date: Date;
    duration: number; // in minutes
    startTime?: Date;
    endTime?: Date;

    description?: string;

    hourlyRate?: number;
    billable: boolean;

    createdAt: Date;
    updatedAt: Date;
}

const TimeLogSchema = new Schema<ITimeLog>(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
        taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        date: { type: Date, required: true },
        duration: { type: Number, required: true, min: 1 }, // in minutes
        startTime: Date,
        endTime: Date,

        description: { type: String, trim: true },

        hourlyRate: Number,
        billable: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
);

// Indexes for performance and finance queries
TimeLogSchema.index({ projectId: 1 });
TimeLogSchema.index({ taskId: 1 });
TimeLogSchema.index({ userId: 1 });
TimeLogSchema.index({ date: 1 });
TimeLogSchema.index({ userId: 1, date: 1 }); // Compound index for user daily logs
TimeLogSchema.index({ projectId: 1, date: 1 }); // For project time reports
TimeLogSchema.index({ billable: 1 }); // For billing reports

export const TimeLog = mongoose.model<ITimeLog>('TimeLog', TimeLogSchema);
