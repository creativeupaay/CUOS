import { randomUUID } from 'crypto';
import {
    ClientSession,
    Document,
    FilterQuery,
    Model,
    QueryOptions,
    Types,
    connection,
    startSession,
} from 'mongoose';
import AppError from '../../../utils/appError';
import { logger } from '../../../utils/logger';
import { DeletedRecord, IDeletedRecord } from '../models/DeletedRecord.model';
import {
    ARCHIVE_RETENTION_MS,
    ArchiveDeleteResult,
    ArchiveWriteOptions,
} from '../types/archive.types';
import {
    createArchiveSnapshot,
    getSnapshotObjectId,
} from '../utils/archiveSnapshot.util';

type ArchiveModel<TDocument extends Document> = Model<TDocument>;

interface ArchiveAuditContext {
    archiveBatchId: string;
    actorId?: string;
    operation?: string;
    sourceModel?: string;
    sourceCollection?: string;
    sourceIds?: string[];
}

const toObjectId = (value: Types.ObjectId | string | undefined): Types.ObjectId | undefined => {
    if (!value) {
        return undefined;
    }

    if (value instanceof Types.ObjectId) {
        return value;
    }

    if (Types.ObjectId.isValid(value)) {
        return new Types.ObjectId(value);
    }

    throw new AppError('Archive actor id must be a valid ObjectId.', 400, 'INVALID_ARCHIVE_ACTOR');
};

const withSession = <TOptions extends QueryOptions>(options: TOptions, session?: ClientSession): TOptions => {
    if (!session) {
        return options;
    }

    return {
        ...options,
        session,
    };
};

const getDocumentModelName = (document: Document): string | undefined => {
    const constructorValue = document.constructor as { modelName?: unknown };
    return typeof constructorValue.modelName === 'string' ? constructorValue.modelName : undefined;
};

const getDocumentCollectionName = (document: Document): string | undefined => {
    const collection = (document as Document & { collection?: { name?: unknown } }).collection;
    return typeof collection?.name === 'string' ? collection.name : undefined;
};

const getArchiveContext = <TDocument extends Document>(
    document: TDocument,
    options: ArchiveWriteOptions,
    model?: ArchiveModel<TDocument>
) => ({
    archiveBatchId: options.archiveBatchId ?? randomUUID(),
    sourceModel: options.sourceModel ?? model?.modelName ?? getDocumentModelName(document),
    sourceCollection: options.sourceCollection ?? model?.collection.name ?? getDocumentCollectionName(document),
});

const buildPurgeAt = (deletedAt: Date, purgeAt?: Date): Date => (
    purgeAt ?? new Date(deletedAt.getTime() + ARCHIVE_RETENTION_MS)
);

const buildArchiveAuditContext = (
    options: ArchiveWriteOptions,
    overrides: Partial<ArchiveAuditContext> = {}
): ArchiveAuditContext => ({
    archiveBatchId: overrides.archiveBatchId ?? options.archiveBatchId ?? 'unassigned',
    actorId: overrides.actorId ?? options.deletedBy?.toString(),
    operation: overrides.operation ?? options.operation,
    sourceModel: overrides.sourceModel ?? options.sourceModel,
    sourceCollection: overrides.sourceCollection ?? options.sourceCollection,
    sourceIds: overrides.sourceIds,
});

const isTransactionUnsupportedError = (error: unknown): boolean => {
    const maybeError = error as { message?: unknown; code?: unknown; codeName?: unknown };
    const message = typeof maybeError.message === 'string' ? maybeError.message : '';
    const codeName = typeof maybeError.codeName === 'string' ? maybeError.codeName : '';

    return maybeError.code === 20
        || codeName === 'IllegalOperation'
        || message.includes('Transaction numbers are only allowed')
        || message.includes('transactions are not supported')
        || message.includes('Transaction is not supported');
};

const runWithOptionalTransaction = async <TResult>(
    operationName: string,
    work: (session?: ClientSession, transactionUsed?: boolean) => Promise<TResult>
): Promise<TResult> => {
    if (connection.readyState !== 1) {
        return work(undefined, false);
    }

    const session = await startSession();

    try {
        let result: TResult | undefined;

        try {
            await session.withTransaction(async () => {
                result = await work(session, true);
            });

            return result as TResult;
        } catch (error) {
            if (!isTransactionUnsupportedError(error)) {
                throw error;
            }

            logger.warn(
                { error, operationName },
                'MongoDB transactions unavailable for archive operation; falling back to strict archive-then-delete sequence'
            );

            return work(undefined, false);
        }
    } finally {
        await session.endSession();
    }
};

export class DeletedRecordService {
    static generateArchiveBatchId(): string {
        return randomUUID();
    }

    static async archiveDocument<TDocument extends Document>(
        document: TDocument,
        options: ArchiveWriteOptions = {},
        model?: ArchiveModel<TDocument>
    ): Promise<IDeletedRecord> {
        const snapshot = createArchiveSnapshot(document);
        const sourceId = getSnapshotObjectId(snapshot, '_id');
        const deletedAt = options.deletedAt ?? new Date();
        const context = getArchiveContext(document, options, model);

        if (!context.sourceModel || !context.sourceCollection) {
            throw new AppError('Archive source model and collection are required.', 500, 'ARCHIVE_SOURCE_MISSING');
        }

        const archivePayload = {
            archiveBatchId: context.archiveBatchId,
            sourceCollection: context.sourceCollection,
            sourceModel: context.sourceModel,
            sourceId,
            documentSnapshot: snapshot,
            relationshipSnapshot: options.relationshipSnapshot,
            operation: options.operation ?? 'delete',
            reason: options.reason,
            deletedBy: toObjectId(options.deletedBy),
            deletedAt,
            purgeAt: buildPurgeAt(deletedAt, options.purgeAt),
            metadata: options.metadata,
            restoreStatus: 'not_requested',
        };

        try {
            const archived = await DeletedRecord.findOneAndUpdate(
                {
                    archiveBatchId: archivePayload.archiveBatchId,
                    sourceCollection: archivePayload.sourceCollection,
                    sourceId: archivePayload.sourceId,
                },
                {
                    $setOnInsert: archivePayload,
                },
                withSession(
                    {
                        upsert: true,
                        new: true,
                        // All fields including purgeAt are explicitly provided in archivePayload,
                        // so setDefaultsOnInsert is not needed and would call default functions
                        // with a null `this` context when no insert occurs.
                    },
                    options.session
                )
            ).exec();

            if (!archived) {
                throw new AppError('Archive record was not created.', 500, 'ARCHIVE_WRITE_FAILED');
            }

            logger.info(
                {
                    archiveBatchId: archivePayload.archiveBatchId,
                    actorId: archivePayload.deletedBy?.toString(),
                    operation: archivePayload.operation,
                    sourceModel: archivePayload.sourceModel,
                    sourceCollection: archivePayload.sourceCollection,
                    sourceId: archivePayload.sourceId.toString(),
                    purgeAt: archivePayload.purgeAt,
                },
                'Archive snapshot persisted'
            );

            return archived;
        } catch (error) {
            logger.error({ error, archivePayload }, 'Archive write failed');
            throw error;
        }
    }

    static async archiveDocuments<TDocument extends Document>(
        documents: TDocument[],
        options: ArchiveWriteOptions = {},
        model?: ArchiveModel<TDocument>
    ): Promise<IDeletedRecord[]> {
        const archiveBatchId = options.archiveBatchId ?? randomUUID();
        const archivedRecords: IDeletedRecord[] = [];

        for (const document of documents) {
            const archived = await this.archiveDocument(
                document,
                {
                    ...options,
                    archiveBatchId,
                },
                model
            );
            archivedRecords.push(archived);
        }

        if (archivedRecords.length !== documents.length) {
            logger.error(
                {
                    ...buildArchiveAuditContext(options, {
                        archiveBatchId,
                        sourceModel: model?.modelName,
                        sourceCollection: model?.collection.name,
                        sourceIds: archivedRecords.map((record) => record.sourceId.toString()),
                    }),
                    expectedCount: documents.length,
                    archivedCount: archivedRecords.length,
                },
                'Archive count verification failed'
            );
            throw new AppError('Archive count verification failed.', 500, 'ARCHIVE_COUNT_MISMATCH');
        }

        logger.info(
            {
                ...buildArchiveAuditContext(options, {
                    archiveBatchId,
                    sourceModel: model?.modelName,
                    sourceCollection: model?.collection.name,
                    sourceIds: archivedRecords.map((record) => record.sourceId.toString()),
                }),
                archivedCount: archivedRecords.length,
            },
            'Archive batch persisted'
        );

        return archivedRecords;
    }

    static async archiveQuery<TDocument extends Document>(
        model: ArchiveModel<TDocument>,
        filter: FilterQuery<TDocument>,
        options: ArchiveWriteOptions = {}
    ): Promise<IDeletedRecord[]> {
        const query = model.find(filter);
        if (options.session) {
            query.session(options.session);
        }

        const documents = await query.exec();
        const archivedRecords = await this.archiveDocuments(documents, options, model);

        logger.info(
            {
                ...buildArchiveAuditContext(options, {
                    archiveBatchId: options.archiveBatchId ?? archivedRecords[0]?.archiveBatchId ?? 'unassigned',
                    sourceModel: model.modelName,
                    sourceCollection: model.collection.name,
                    sourceIds: archivedRecords.map((record) => record.sourceId.toString()),
                }),
                matchedCount: documents.length,
                archivedCount: archivedRecords.length,
            },
            'Archive query completed'
        );

        return archivedRecords;
    }

    static async archiveAndDeleteOne<TDocument extends Document>(
        model: ArchiveModel<TDocument>,
        filter: FilterQuery<TDocument>,
        options: ArchiveWriteOptions = {}
    ): Promise<ArchiveDeleteResult> {
        if (!options.session) {
            return runWithOptionalTransaction('archiveAndDeleteOne', (session, transactionUsed) => (
                this.archiveAndDeleteOneInSequence(model, filter, { ...options, session }, transactionUsed)
            ));
        }

        return this.archiveAndDeleteOneInSequence(model, filter, options, true);
    }

    private static async archiveAndDeleteOneInSequence<TDocument extends Document>(
        model: ArchiveModel<TDocument>,
        filter: FilterQuery<TDocument>,
        options: ArchiveWriteOptions,
        transactionUsed = false
    ): Promise<ArchiveDeleteResult> {
        const query = model.findOne(filter);
        if (options.session) {
            query.session(options.session);
        }

        const document = await query.exec();
        const archiveBatchId = options.archiveBatchId ?? randomUUID();

        if (!document) {
            return {
                archiveBatchId,
                archivedCount: 0,
                deletedCount: 0,
                sourceIds: [],
                transactionUsed,
            };
        }

        await this.archiveDocument(document, { ...options, archiveBatchId }, model);
        const sourceId = document._id as Types.ObjectId;

        const deleteResult = await model.deleteOne(
            { _id: document._id } as FilterQuery<TDocument>,
            withSession({}, options.session)
        ).exec();
        const deletedCount = deleteResult.deletedCount ?? 0;

        if (deletedCount !== 1) {
            logger.error(
                {
                    archiveBatchId,
                    actorId: options.deletedBy?.toString(),
                    operation: options.operation ?? 'delete',
                    sourceModel: model.modelName,
                    sourceCollection: model.collection.name,
                    sourceIds: [sourceId.toString()],
                    archivedCount: 1,
                    deletedCount,
                    transactionUsed,
                },
                'Archive delete count verification failed'
            );
            throw new AppError('Archive delete count verification failed.', 500, 'ARCHIVE_DELETE_COUNT_MISMATCH');
        }

        logger.info(
            {
                archiveBatchId,
                actorId: options.deletedBy?.toString(),
                operation: options.operation ?? 'delete',
                sourceModel: model.modelName,
                sourceCollection: model.collection.name,
                sourceIds: [sourceId.toString()],
                archivedCount: 1,
                deletedCount,
                transactionUsed,
            },
            'Archive and delete completed'
        );

        return {
            archiveBatchId,
            archivedCount: 1,
            deletedCount,
            sourceIds: [sourceId],
            transactionUsed,
        };
    }

    static async archiveAndDeleteMany<TDocument extends Document>(
        model: ArchiveModel<TDocument>,
        filter: FilterQuery<TDocument>,
        options: ArchiveWriteOptions = {}
    ): Promise<ArchiveDeleteResult> {
        if (!options.session) {
            return runWithOptionalTransaction('archiveAndDeleteMany', (session, transactionUsed) => (
                this.archiveAndDeleteManyInSequence(model, filter, { ...options, session }, transactionUsed)
            ));
        }

        return this.archiveAndDeleteManyInSequence(model, filter, options, true);
    }

    private static async archiveAndDeleteManyInSequence<TDocument extends Document>(
        model: ArchiveModel<TDocument>,
        filter: FilterQuery<TDocument>,
        options: ArchiveWriteOptions,
        transactionUsed = false
    ): Promise<ArchiveDeleteResult> {
        const archiveBatchId = options.archiveBatchId ?? randomUUID();
        const archivedRecords = await this.archiveQuery(model, filter, {
            ...options,
            archiveBatchId,
        });

        if (archivedRecords.length === 0) {
            return {
                archiveBatchId,
                archivedCount: 0,
                deletedCount: 0,
                sourceIds: [],
                transactionUsed,
            };
        }

        const sourceIds = archivedRecords.map((record) => record.sourceId);
        const activeCount = await model.countDocuments(
            { _id: { $in: sourceIds } } as FilterQuery<TDocument>
        ).session(options.session ?? null).exec();

        if (activeCount !== sourceIds.length) {
            logger.error(
                {
                    archiveBatchId,
                    actorId: options.deletedBy?.toString(),
                    operation: options.operation ?? 'delete',
                    sourceModel: model.modelName,
                    sourceCollection: model.collection.name,
                    sourceIds: sourceIds.map((sourceId) => sourceId.toString()),
                    archivedCount: archivedRecords.length,
                    activeCount,
                    transactionUsed,
                },
                'Archive delete preflight count verification failed'
            );
            throw new AppError('Archive delete preflight count verification failed.', 500, 'ARCHIVE_DELETE_PREFLIGHT_MISMATCH');
        }

        const deleteResult = await model.deleteMany(
            { _id: { $in: sourceIds } } as FilterQuery<TDocument>,
            withSession({}, options.session)
        ).exec();
        const deletedCount = deleteResult.deletedCount ?? 0;

        if (deletedCount !== archivedRecords.length) {
            logger.error(
                {
                    archiveBatchId,
                    actorId: options.deletedBy?.toString(),
                    operation: options.operation ?? 'delete',
                    sourceModel: model.modelName,
                    sourceCollection: model.collection.name,
                    sourceIds: sourceIds.map((sourceId) => sourceId.toString()),
                    archivedCount: archivedRecords.length,
                    deletedCount,
                    transactionUsed,
                },
                'Archive delete count verification failed'
            );
            throw new AppError('Archive delete count verification failed.', 500, 'ARCHIVE_DELETE_COUNT_MISMATCH');
        }

        logger.info(
            {
                archiveBatchId,
                actorId: options.deletedBy?.toString(),
                operation: options.operation ?? 'delete',
                sourceModel: model.modelName,
                sourceCollection: model.collection.name,
                sourceIds: sourceIds.map((sourceId) => sourceId.toString()),
                archivedCount: archivedRecords.length,
                deletedCount,
                transactionUsed,
            },
            'Archive and delete completed'
        );

        return {
            archiveBatchId,
            archivedCount: archivedRecords.length,
            deletedCount,
            sourceIds,
            transactionUsed,
        };
    }
}

export const archiveDocument = DeletedRecordService.archiveDocument.bind(DeletedRecordService);
export const archiveDocuments = DeletedRecordService.archiveDocuments.bind(DeletedRecordService);
export const archiveQuery = DeletedRecordService.archiveQuery.bind(DeletedRecordService);
export const archiveAndDeleteOne = DeletedRecordService.archiveAndDeleteOne.bind(DeletedRecordService);
export const archiveAndDeleteMany = DeletedRecordService.archiveAndDeleteMany.bind(DeletedRecordService);
