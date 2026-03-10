import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComment extends Document {
    _id: Types.ObjectId;
    projectId: Types.ObjectId;
    entityType: 'task' | 'meeting';
    entityId: Types.ObjectId;
    content: string;
    authorType: 'user' | 'client';
    userId?: Types.ObjectId;
    clientId?: Types.ObjectId;
    authorName: string;
    createdAt: Date;
    updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
        entityType: { type: String, enum: ['task', 'meeting'], required: true },
        entityId: { type: Schema.Types.ObjectId, required: true },
        content: { type: String, required: true, trim: true, maxlength: 2000 },
        authorType: { type: String, enum: ['user', 'client'], required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
        authorName: { type: String, required: true, trim: true },
    },
    { timestamps: true }
);

CommentSchema.index({ entityId: 1, entityType: 1, createdAt: 1 });
CommentSchema.index({ projectId: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
