import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAttendance extends Document {
    _id: Types.ObjectId;
    employeeId: Types.ObjectId;
    date: Date;
    checkIn?: Date;
    checkOut?: Date;
    totalHours: number;
    breakMinutes?: number;
    status: 'present' | 'wfh' | 'half-day' | 'absent' | 'on-leave' | 'holiday';
    source: 'manual' | 'auto' | 'leave' | 'admin-override'; // how was this record created?
    overriddenBy?: Types.ObjectId;   // User._id of the admin who overrode
    overrideReason?: string;         // optional admin note
    projectId?: Types.ObjectId;
    taskId?: Types.ObjectId;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        date: { type: Date, required: true },
        checkIn: { type: Date },
        checkOut: { type: Date },
        totalHours: { type: Number, default: 0, min: 0 },
        breakMinutes: { type: Number, default: 0, min: 0 },
        status: {
            type: String,
            required: true,
            enum: ['present', 'wfh', 'half-day', 'absent', 'on-leave', 'holiday'],
            default: 'present',
        },
        source: {
            type: String,
            enum: ['manual', 'auto', 'leave', 'admin-override'],
            default: 'manual',
        },
        overriddenBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        overrideReason: { type: String, trim: true },
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
        },
        taskId: {
            type: Schema.Types.ObjectId,
            ref: 'Task',
        },
        notes: { type: String, trim: true },
    },
    {
        timestamps: true,
    }
);

// Indexes
AttendanceSchema.index({ employeeId: 1, date: 1 });
AttendanceSchema.index({ projectId: 1 });
AttendanceSchema.index({ date: 1 });

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
