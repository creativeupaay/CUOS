import {
    ClientSession,
    Types,
    connection,
    startSession,
} from 'mongoose';
import AppError from '../../../utils/appError';
import { logger } from '../../../utils/logger';
import { DeletedRecord, IDeletedRecord } from '../models/DeletedRecord.model';
import {
    ArchiveRestoreOptions,
    ArchiveRestoreResult,
} from '../types/archive.types';
import { getArchiveModel } from '../utils/modelRegistry.util';

const RESTORE_MODEL_PRIORITY: Record<string, number> = {
    Permission: 10,
    Role: 20,
    User: 30,
    Client: 100,
    Partner: 100,
    Employee: 100,
    Job: 100,
    Project: 100,
    Lead: 110,
    Proposal: 120,
    BankAccount: 800,
    Revenue: 850,
    Expense: 850,
    FixedExpense: 850,
    FixedExpenseApproval: 860,
    Payroll: 860,
    BankTransaction: 900,
};

const getRestorePriority = (sourceModel: string): number => RESTORE_MODEL_PRIORITY[sourceModel] ?? 500;

const compareArchiveRecordsForRestore = (left: IDeletedRecord, right: IDeletedRecord): number => {
    const priorityDelta = getRestorePriority(left.sourceModel) - getRestorePriority(right.sourceModel);
    if (priorityDelta !== 0) {
        return priorityDelta;
    }

    const deletedAtDelta = left.deletedAt.getTime() - right.deletedAt.getTime();
    if (deletedAtDelta !== 0) {
        return deletedAtDelta;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
};

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

const runRestoreWithOptionalTransaction = async <TResult>(
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
                'MongoDB transactions unavailable for archive restore; falling back to strict restore sequence'
            );

            return work(undefined, false);
        }
    } finally {
        await session.endSession();
    }
};

export class ArchiveRestoreService {
    static getRestorePriority(sourceModel: string): number {
        return getRestorePriority(sourceModel);
    }

    static async restoreRecord(
        archiveRecordId: Types.ObjectId | string,
        options: ArchiveRestoreOptions = {}
    ): Promise<ArchiveRestoreResult> {
        if (!options.session && !options.dryRun) {
            return runRestoreWithOptionalTransaction('restoreRecord', (session) => (
                this.restoreRecordInSequence(archiveRecordId, { ...options, session })
            ));
        }

        return this.restoreRecordInSequence(archiveRecordId, options);
    }

    private static async restoreRecordInSequence(
        archiveRecordId: Types.ObjectId | string,
        options: ArchiveRestoreOptions = {}
    ): Promise<ArchiveRestoreResult> {
        const archiveRecord = await DeletedRecord.findById(archiveRecordId)
            .session(options.session ?? null)
            .exec();

        if (!archiveRecord) {
            throw new AppError('Archive record not found.', 404, 'ARCHIVE_RECORD_NOT_FOUND');
        }

        logger.info(
            {
                archiveRecordId: archiveRecord._id.toString(),
                archiveBatchId: archiveRecord.archiveBatchId,
                sourceModel: archiveRecord.sourceModel,
                sourceCollection: archiveRecord.sourceCollection,
                sourceId: archiveRecord.sourceId.toString(),
                dryRun: options.dryRun ?? false,
                transactionUsed: Boolean(options.session),
            },
            'Archive restore attempt started'
        );

        return this.restoreDeletedRecord(archiveRecord, options);
    }

    static async restoreBatch(
        archiveBatchId: string,
        options: ArchiveRestoreOptions = {}
    ): Promise<ArchiveRestoreResult[]> {
        if (!options.session && !options.dryRun) {
            return runRestoreWithOptionalTransaction('restoreBatch', (session) => (
                this.restoreBatchInSequence(archiveBatchId, { ...options, session })
            ));
        }

        return this.restoreBatchInSequence(archiveBatchId, options);
    }

    private static async restoreBatchInSequence(
        archiveBatchId: string,
        options: ArchiveRestoreOptions = {}
    ): Promise<ArchiveRestoreResult[]> {
        const archiveRecords = await DeletedRecord.find({ archiveBatchId })
            .session(options.session ?? null)
            .exec();
        archiveRecords.sort(compareArchiveRecordsForRestore);

        const results: ArchiveRestoreResult[] = [];

        logger.info(
            {
                archiveBatchId,
                archiveRecordCount: archiveRecords.length,
                dryRun: options.dryRun ?? false,
                transactionUsed: Boolean(options.session),
                collectionCounts: archiveRecords.reduce<Record<string, number>>((counts, record) => {
                    counts[record.sourceCollection] = (counts[record.sourceCollection] ?? 0) + 1;
                    return counts;
                }, {}),
            },
            'Archive batch restore attempt started'
        );

        try {
            for (const archiveRecord of archiveRecords) {
                results.push(await this.restoreDeletedRecord(archiveRecord, options));
            }
        } catch (error) {
            logger.error(
                {
                    error,
                    archiveBatchId,
                    attemptedCount: archiveRecords.length,
                    completedCount: results.length,
                    restoredIds: results
                        .filter((result) => result.restored)
                        .map((result) => result.sourceId.toString()),
                    transactionUsed: Boolean(options.session),
                },
                'Archive batch restore failed'
            );
            throw error;
        }

        logger.info(
            {
                archiveBatchId,
                attemptedCount: archiveRecords.length,
                restoredCount: results.filter((result) => result.restored).length,
                skippedCount: results.filter((result) => result.skipped).length,
                dryRun: options.dryRun ?? false,
                transactionUsed: Boolean(options.session),
            },
            'Archive batch restore completed'
        );

        return results;
    }

    private static async restoreDeletedRecord(
        archiveRecord: IDeletedRecord,
        options: ArchiveRestoreOptions
    ): Promise<ArchiveRestoreResult> {
        const model = getArchiveModel(archiveRecord.sourceModel);
        const existing = await model.findById(archiveRecord.sourceId)
            .session(options.session ?? null)
            .lean()
            .exec();

        const baseResult = {
            archiveRecordId: archiveRecord._id,
            archiveBatchId: archiveRecord.archiveBatchId,
            sourceModel: archiveRecord.sourceModel,
            sourceCollection: archiveRecord.sourceCollection,
            sourceId: archiveRecord.sourceId,
        };

        if (existing) {
            if (!options.dryRun) {
                await archiveRecord.updateOne(
                    { $set: { restoreStatus: 'failed' } },
                    { session: options.session }
                ).exec();
            }

            logger.warn(
                {
                    archiveRecordId: archiveRecord._id,
                    archiveBatchId: archiveRecord.archiveBatchId,
                    sourceModel: archiveRecord.sourceModel,
                    sourceId: archiveRecord.sourceId,
                    dryRun: options.dryRun ?? false,
                },
                'Archive restore conflict: active record already exists'
            );

            return {
                ...baseResult,
                restored: false,
                skipped: true,
                reason: 'Active record already exists with the archived _id.',
            };
        }

        if (options.dryRun) {
            logger.info(
                {
                    archiveRecordId: archiveRecord._id,
                    archiveBatchId: archiveRecord.archiveBatchId,
                    sourceModel: archiveRecord.sourceModel,
                    sourceCollection: archiveRecord.sourceCollection,
                    sourceId: archiveRecord.sourceId,
                },
                'Archive restore dry-run completed'
            );

            return {
                ...baseResult,
                restored: false,
                skipped: false,
                reason: 'Dry run only.',
            };
        }

        try {
            await model.create([archiveRecord.documentSnapshot], { session: options.session });
            archiveRecord.restoreStatus = 'restored';
            await archiveRecord.save({ session: options.session });

            logger.info(
                {
                    archiveRecordId: archiveRecord._id,
                    archiveBatchId: archiveRecord.archiveBatchId,
                    sourceModel: archiveRecord.sourceModel,
                    sourceCollection: archiveRecord.sourceCollection,
                    sourceId: archiveRecord.sourceId,
                    transactionUsed: Boolean(options.session),
                },
                'Archive record restored'
            );

            return {
                ...baseResult,
                restored: true,
                skipped: false,
            };
        } catch (error) {
            archiveRecord.restoreStatus = 'failed';
            await archiveRecord.save({ session: options.session });
            logger.error({ error, archiveRecordId: archiveRecord._id }, 'Archive restore failed');
            throw error;
        }
    }
}
