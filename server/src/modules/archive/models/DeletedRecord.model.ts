import mongoose, { Document, Schema, Types } from 'mongoose';
import {
    ARCHIVE_RETENTION_MS,
    ArchiveMetadata,
    ArchiveOperation,
    ArchiveRelationshipSnapshot,
    ArchiveRestoreStatus,
    ArchiveSnapshot,
} from '../types/archive.types';

export interface IDeletedRecord extends Document {
    _id: Types.ObjectId;
    archiveBatchId: string;
    sourceCollection: string;
    sourceModel: string;
    sourceId: Types.ObjectId;
    documentSnapshot: ArchiveSnapshot;
    relationshipSnapshot?: ArchiveRelationshipSnapshot;
    operation: ArchiveOperation;
    reason?: string;
    deletedBy?: Types.ObjectId;
    deletedAt: Date;
    purgeAt: Date;
    metadata?: ArchiveMetadata;
    restoreStatus: ArchiveRestoreStatus;
    createdAt: Date;
    updatedAt: Date;
}

const DeletedRecordSchema = new Schema<IDeletedRecord>(
    {
        archiveBatchId: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        sourceCollection: {
            type: String,
            required: true,
            trim: true,
        },
        sourceModel: {
            type: String,
            required: true,
            trim: true,
        },
        sourceId: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        documentSnapshot: {
            type: Schema.Types.Mixed,
            required: true,
        },
        relationshipSnapshot: {
            type: Schema.Types.Mixed,
            default: undefined,
        },
        operation: {
            type: String,
            enum: ['delete', 'cascade_delete', 'soft_archive', 'detach_reference', 'external_retention'],
            default: 'delete',
            required: true,
        },
        reason: {
            type: String,
            trim: true,
        },
        deletedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        deletedAt: {
            type: Date,
            default: Date.now,
            required: true,
        },
        purgeAt: {
            type: Date,
            default: function calculatePurgeAt(this: IDeletedRecord) {
                const deletedAt = this.deletedAt ?? new Date();
                return new Date(deletedAt.getTime() + ARCHIVE_RETENTION_MS);
            },
            required: true,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: undefined,
        },
        restoreStatus: {
            type: String,
            enum: ['not_requested', 'pending', 'restored', 'failed'],
            default: 'not_requested',
            required: true,
        },
    },
    {
        collection: 'deletedrecords',
        timestamps: true,
    }
);

DeletedRecordSchema.index({ sourceCollection: 1, sourceId: 1 });
DeletedRecordSchema.index({ operation: 1, deletedAt: -1 });
DeletedRecordSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
DeletedRecordSchema.index(
    { archiveBatchId: 1, sourceCollection: 1, sourceId: 1 },
    { unique: true }
);

export const DeletedRecord = mongoose.model<IDeletedRecord>('DeletedRecord', DeletedRecordSchema);

