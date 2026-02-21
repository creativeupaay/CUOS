import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITask extends Document {
    _id: Types.ObjectId;
    title: string;
    description?: string;
    status: 'todo' | 'in-progress' | 'completed';
    priority: 'low' | 'medium' | 'high' | 'critical';

    projectId: Types.ObjectId;
    parentTaskId?: Types.ObjectId;

    startDate?: Date;
    endDate?: Date;
    deadline?: Date;
    estimatedHours?: number;

    assignees: Types.ObjectId[];

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

const TaskSchema = new Schema<ITask>(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        status: {
            type: String,
            enum: ['todo', 'in-progress', 'completed'],
            default: 'todo',
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
        },

        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
        parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },

        startDate: Date,
        endDate: Date,
        deadline: Date,
        estimatedHours: Number,

        assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        completedAt: Date,
    },
    {
        timestamps: true,
    }
);

// Indexes for performance
TaskSchema.index({ projectId: 1 });
TaskSchema.index({ parentTaskId: 1 });
TaskSchema.index({ assignees: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ createdAt: -1 });

// Pre-save hook to set completedAt when status changes to completed
TaskSchema.pre('save', function (next) {
    if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }
    next();
});

export const Task = mongoose.model<ITask>('Task', TaskSchema);
