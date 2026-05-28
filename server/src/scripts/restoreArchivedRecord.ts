import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { ArchiveRestoreService } from '../modules/archive/services/archiveRestore.service';
import { ArchiveRestoreResult } from '../modules/archive/types/archive.types';
import { recalculateBankBalances } from './recalculateBankBalances';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cuos';

const FINANCE_RECALCULATION_MODELS = new Set([
    'BankAccount',
    'BankTransaction',
    'Revenue',
    'Expense',
    'FixedExpense',
    'FixedExpenseApproval',
    'Payroll',
]);

const getArg = (name: string): string | undefined => {
    const prefixed = `--${name}=`;
    const inline = process.argv.find((arg) => arg.startsWith(prefixed));
    if (inline) {
        return inline.slice(prefixed.length);
    }

    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
};

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

const ensureValidObjectId = (value: string, label: string): void => {
    if (!Types.ObjectId.isValid(value)) {
        throw new Error(`${label} must be a valid ObjectId.`);
    }
};

const summarizeRestore = (results: ArchiveRestoreResult[]) => ({
    total: results.length,
    restored: results.filter((result) => result.restored).length,
    skipped: results.filter((result) => result.skipped).length,
    dryRunReady: results.filter((result) => !result.restored && !result.skipped && result.reason === 'Dry run only.').length,
    failedOrConflicted: results.filter((result) => result.skipped || result.reason).length,
});

const requiresBankBalanceRecalculation = (results: ArchiveRestoreResult[]): boolean => (
    results.some((result) => result.restored && FINANCE_RECALCULATION_MODELS.has(result.sourceModel))
);

const run = async (): Promise<void> => {
    const recordId = getArg('record-id') ?? getArg('archive-record-id');
    const batchId = getArg('batch-id') ?? getArg('archive-batch-id');
    const dryRun = hasFlag('--dry-run');
    const skipBankRecalculation = hasFlag('--skip-bank-recalculation');

    if ((recordId && batchId) || (!recordId && !batchId)) {
        throw new Error(
            'Usage: ts-node src/scripts/restoreArchivedRecord.ts (--record-id <archiveRecordId> | --batch-id <archiveBatchId>) [--dry-run] [--skip-bank-recalculation]'
        );
    }

    if (recordId) {
        ensureValidObjectId(recordId, 'record-id');
    }

    await mongoose.connect(MONGODB_URI);

    const results = recordId
        ? [await ArchiveRestoreService.restoreRecord(recordId, { dryRun })]
        : await ArchiveRestoreService.restoreBatch(batchId as string, { dryRun });

    const payload: Record<string, unknown> = {
        mode: recordId ? 'record' : 'batch',
        dryRun,
        summary: summarizeRestore(results),
        results,
    };

    if (!dryRun && !skipBankRecalculation && requiresBankBalanceRecalculation(results)) {
        payload.bankBalanceRecalculation = await recalculateBankBalances();
    } else if (!dryRun && skipBankRecalculation && requiresBankBalanceRecalculation(results)) {
        payload.bankBalanceRecalculation = {
            skipped: true,
            nextStep: 'Run ts-node src/scripts/recalculateBankBalances.ts before relying on finance balances.',
        };
    }

    console.log(JSON.stringify(payload, null, 2));
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
