import { ClientSession, Types } from 'mongoose';

export const ARCHIVE_RETENTION_DAYS = 30;
export const ARCHIVE_RETENTION_MS = ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type ArchiveOperation =
    | 'delete'
    | 'cascade_delete'
    | 'soft_archive'
    | 'detach_reference'
    | 'external_retention';

export type ArchiveRestoreStatus = 'not_requested' | 'pending' | 'restored' | 'failed';

export type ArchiveSnapshot = Record<string, unknown>;

export interface ArchiveRelationshipSnapshot {
    parent?: {
        sourceModel: string;
        sourceCollection: string;
        sourceId: Types.ObjectId;
    };
    children?: Array<{
        sourceModel: string;
        sourceCollection: string;
        sourceIds: Types.ObjectId[];
        relationship: string;
    }>;
    references?: Record<string, unknown>;
    deleteGraph?: DeleteGraphRelationshipSnapshot;
}

export interface ArchiveMetadata {
    [key: string]: unknown;
}

export interface ArchiveWriteOptions {
    archiveBatchId?: string;
    operation?: ArchiveOperation;
    reason?: string;
    deletedBy?: Types.ObjectId | string;
    deletedAt?: Date;
    purgeAt?: Date;
    relationshipSnapshot?: ArchiveRelationshipSnapshot;
    metadata?: ArchiveMetadata;
    sourceModel?: string;
    sourceCollection?: string;
    session?: ClientSession;
    cascade?: boolean;
}

export interface ArchiveDeleteResult {
    archiveBatchId: string;
    archivedCount: number;
    deletedCount: number;
    sourceIds?: Types.ObjectId[];
    transactionUsed?: boolean;
}

export interface ArchiveRestoreOptions {
    dryRun?: boolean;
    session?: ClientSession;
}

export interface ArchiveRestoreResult {
    archiveRecordId: Types.ObjectId;
    archiveBatchId: string;
    sourceModel: string;
    sourceCollection: string;
    sourceId: Types.ObjectId;
    restored: boolean;
    skipped: boolean;
    reason?: string;
}

export interface ArchiveDeleteOptions {
    archiveBatchId?: string;
    deletedBy?: Types.ObjectId | string;
    reason?: string;
    session?: ClientSession;
    metadata?: ArchiveMetadata;
    skipArchive?: boolean;
    cascade?: boolean;
}

export type DeleteGraphRelationKind = 'self' | 'cascade' | 'linked_finance' | 'external_asset' | 'reference_only';

export interface DeleteGraphNode {
    sourceModel: string;
    sourceCollection: string;
    relationship: string;
    relationKind: DeleteGraphRelationKind;
    cascade: boolean;
    filter: Record<string, unknown>;
    sourceIds: Types.ObjectId[];
    count: number;
    embeddedPaths?: string[];
    metadata?: Record<string, unknown>;
}

export interface DeleteGraphResult {
    rootModel: string;
    rootCollection: string;
    rootId: Types.ObjectId;
    archiveBatchId: string;
    nodes: DeleteGraphNode[];
}

export interface DeleteGraphRelationshipSnapshot {
    rootModel: string;
    rootCollection: string;
    rootId: Types.ObjectId;
    archiveBatchId: string;
    nodes: Array<{
        sourceModel: string;
        sourceCollection: string;
        relationship: string;
        relationKind: DeleteGraphRelationKind;
        cascade: boolean;
        sourceIds: Types.ObjectId[];
        count: number;
        embeddedPaths?: string[];
        metadata?: Record<string, unknown>;
    }>;
}
