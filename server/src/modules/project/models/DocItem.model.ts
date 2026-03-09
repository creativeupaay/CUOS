import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDocItem extends Document {
    _id: Types.ObjectId;
    projectId: Types.ObjectId;
    folderId: Types.ObjectId | null;
    name: string;
    cloudinaryId: string;
    size: number;
    mimeType: string;
    uploadedBy: Types.ObjectId;
    viewAccess: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const DocItemSchema = new Schema<IDocItem>(
    {
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        folderId: {
            type: Schema.Types.ObjectId,
            ref: 'DocFolder',
            default: null,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        cloudinaryId: {
            type: String,
            required: true,
        },
        size: {
            type: Number,
            required: true,
        },
        mimeType: {
            type: String,
            default: 'application/octet-stream',
        },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        viewAccess: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    },
    { timestamps: true }
);

DocItemSchema.index({ projectId: 1, folderId: 1 });

export const DocItem = mongoose.model<IDocItem>('DocItem', DocItemSchema);
