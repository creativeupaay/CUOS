import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { DeletedRecord, IDeletedRecord } from '../modules/archive/models/DeletedRecord.model';
import { ArchiveRestoreService } from '../modules/archive/services/archiveRestore.service';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cuos';

const getArg = (name: string): string | undefined => {
    const prefixed = `--${name}=`;
    const inline = process.argv.find((arg) => arg.startsWith(prefixed));
    if (inline) {
        return inline.slice(prefixed.length);
    }

    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
};

const compareForRestore = (left: IDeletedRecord, right: IDeletedRecord): number => {
    const priorityDelta = ArchiveRestoreService.getRestorePriority(left.sourceModel)
        - ArchiveRestoreService.getRestorePriority(right.sourceModel);
    if (priorityDelta !== 0) {
        return priorityDelta;
    }

    const deletedAtDelta = left.deletedAt.getTime() - right.deletedAt.getTime();
    if (deletedAtDelta !== 0) {
        return deletedAtDelta;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
};

const summarizeRecords = (records: IDeletedRecord[]) => {
    const byModel = new Map<string, number>();
    const byStatus = new Map<string, number>();

    for (const record of records) {
        byModel.set(record.sourceModel, (byModel.get(record.sourceModel) ?? 0) + 1);
        byStatus.set(record.restoreStatus, (byStatus.get(record.restoreStatus) ?? 0) + 1);
    }

    return {
        byModel: Object.fromEntries([...byModel.entries()].sort(([left], [right]) => left.localeCompare(right))),
        byStatus: Object.fromEntries([...byStatus.entries()].sort(([left], [right]) => left.localeCompare(right))),
    };
};

const run = async (): Promise<void> => {
    const archiveBatchId = getArg('batch-id') ?? getArg('archive-batch-id');
    if (!archiveBatchId) {
        throw new Error('Usage: ts-node src/scripts/listArchiveBatch.ts --batch-id <archiveBatchId>');
    }

    await mongoose.connect(MONGODB_URI);

    const records = await DeletedRecord.find({ archiveBatchId }).exec();
    records.sort(compareForRestore);

    const payload = {
        archiveBatchId,
        totalRecords: records.length,
        ...summarizeRecords(records),
        restoreOrder: records.map((record, index) => ({
            order: index + 1,
            archiveRecordId: record._id.toString(),
            sourceModel: record.sourceModel,
            sourceCollection: record.sourceCollection,
            sourceId: record.sourceId.toString(),
            operation: record.operation,
            restoreStatus: record.restoreStatus,
            deletedAt: record.deletedAt,
            purgeAt: record.purgeAt,
            reason: record.reason,
        })),
    };

    console.log(JSON.stringify(payload, null, 2));
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
