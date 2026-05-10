import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { BankAccount } from '../modules/finance/models/BankAccount.model';
import { BankAccountKey, BankTransaction } from '../modules/finance/models/BankTransaction.model';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cuos';

interface RecalculateBankBalancesOptions {
    dryRun?: boolean;
}

interface AccountBalanceResult {
    bankAccountId: string;
    accountKey?: BankAccountKey;
    accountName: string;
    previousBalance: number;
    recalculatedBalance: number;
    changed: boolean;
}

interface RecalculateBankBalancesResult {
    dryRun: boolean;
    updatedCount: number;
    accounts: AccountBalanceResult[];
    orphanTransactionAccountIds: string[];
}

interface BalanceByAccountId {
    _id: Types.ObjectId;
    balance: number;
}

interface BalanceByAccountKey {
    _id: BankAccountKey;
    balance: number;
}

const roundMoney = (value: number): number => Math.round(Number(value || 0) * 100) / 100;

const balanceSumExpression = {
    $sum: {
        $cond: [
            { $eq: ['$transactionType', 'credit'] },
            '$amount',
            { $multiply: ['$amount', -1] },
        ],
    },
};

export const recalculateBankBalances = async (
    options: RecalculateBankBalancesOptions = {}
): Promise<RecalculateBankBalancesResult> => {
    const [balancesByAccountId, legacyBalancesByAccountKey, accounts] = await Promise.all([
        BankTransaction.aggregate<BalanceByAccountId>([
            { $match: { bankAccountId: { $exists: true, $ne: null } } },
            { $group: { _id: '$bankAccountId', balance: balanceSumExpression } },
        ]),
        BankTransaction.aggregate<BalanceByAccountKey>([
            {
                $match: {
                    $or: [
                        { bankAccountId: { $exists: false } },
                        { bankAccountId: null },
                    ],
                },
            },
            { $group: { _id: '$accountKey', balance: balanceSumExpression } },
        ]),
        BankAccount.find().sort({ accountKey: 1, accountName: 1 }).exec(),
    ]);

    const balanceByAccountId = new Map(
        balancesByAccountId.map((item) => [item._id.toString(), roundMoney(item.balance)])
    );
    const legacyBalanceByAccountKey = new Map(
        legacyBalancesByAccountKey.map((item) => [item._id, roundMoney(item.balance)])
    );
    const knownAccountIds = new Set(accounts.map((account) => account._id.toString()));

    const orphanTransactionAccountIds = balancesByAccountId
        .map((item) => item._id.toString())
        .filter((accountId) => !knownAccountIds.has(accountId));

    const results: AccountBalanceResult[] = [];
    let updatedCount = 0;

    for (const account of accounts) {
        const accountId = account._id.toString();
        const directBalance = balanceByAccountId.get(accountId) ?? 0;
        const legacyBalance = account.accountKey ? legacyBalanceByAccountKey.get(account.accountKey) ?? 0 : 0;
        const recalculatedBalance = roundMoney(directBalance + legacyBalance);
        const previousBalance = roundMoney(account.currentBalance);
        const changed = previousBalance !== recalculatedBalance;

        results.push({
            bankAccountId: accountId,
            accountKey: account.accountKey,
            accountName: account.accountName,
            previousBalance,
            recalculatedBalance,
            changed,
        });

        if (changed && !options.dryRun) {
            account.currentBalance = recalculatedBalance;
            await account.save();
            updatedCount += 1;
        } else if (changed) {
            updatedCount += 1;
        }
    }

    return {
        dryRun: options.dryRun ?? false,
        updatedCount,
        accounts: results,
        orphanTransactionAccountIds,
    };
};

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

const runCli = async (): Promise<void> => {
    await mongoose.connect(MONGODB_URI);
    const result = await recalculateBankBalances({ dryRun: hasFlag('--dry-run') });
    console.log(JSON.stringify(result, null, 2));
    await mongoose.disconnect();
};

if (require.main === module) {
    runCli().catch(async (error) => {
        console.error(error);
        await mongoose.disconnect();
        process.exit(1);
    });
}
