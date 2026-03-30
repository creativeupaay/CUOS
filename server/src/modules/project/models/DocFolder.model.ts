import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDocFolder extends Document {
    _id: Types.ObjectId;
    projectId: Types.ObjectId;
    name: string;
    parentId: Types.ObjectId | null;
    createdBy: Types.ObjectId;
    viewAccess: Types.ObjectId[];
    isSystem: boolean;        // Cannot be deleted
    isClientShared: boolean;  // Visible in client portal
    isPartnerShared: boolean; // Visible in partner portal
    createdAt: Date;
    updatedAt: Date;
}

const DocFolderSchema = new Schema<IDocFolder>(
    {
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: 'DocFolder',
            default: null,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        viewAccess: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        isSystem: { type: Boolean, default: false },
        isClientShared: { type: Boolean, default: false },
        isPartnerShared: { type: Boolean, default: false },
    },
    { timestamps: true }
);

DocFolderSchema.index({ projectId: 1, parentId: 1 });

export const DocFolder = mongoose.model<IDocFolder>('DocFolder', DocFolderSchema);
