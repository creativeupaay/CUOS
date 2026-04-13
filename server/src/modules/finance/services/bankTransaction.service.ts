import { FilterQuery, Types } from 'mongoose';
import { BankAccount, IBankAccount } from '../models/BankAccount.model';
import {
    BankTransaction,
    BankAccountKey,
    BankTransactionType,
    IBankTransaction,
} from '../models/BankTransaction.model';

interface CreateBankTransactionData {
    accountKey: BankAccountKey;
    transactionType: BankTransactionType;
    amount: number;
    date: Date;
    description: string;
    referenceNumber?: string;
    notes?: string;
    source?: 'manual' | 'automatic';
    expenseId?: Types.ObjectId;
    payrollId?: Types.ObjectId;
    createdBy: Types.ObjectId;
}

interface BankTransactionFilters {
    accountKey?: BankAccountKey;
    transactionType?: BankTransactionType;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}

const MANAGED_ACCOUNTS: Record<BankAccountKey, { accountName: string; bankName: string; accountNumber: string; accountType: 'current' | 'cash'; isPrimary: boolean }> = {
    hdfc_gst: {
        accountName: 'HDFC (GST)',
        bankName: 'HDFC',
        accountNumber: 'HDFC-GST',
        accountType: 'current',
        isPrimary: true,
    },
    sbi_non_gst: {
        accountName: 'SBI (non-GST)',
        bankName: 'SBI',
        accountNumber: 'SBI-NON-GST',
        accountType: 'current',
        isPrimary: false,
    },
    cash: {
        accountName: 'Cash in Company',
        bankName: 'Cash in Company',
        accountNumber: 'CASH-IN-HAND',
        accountType: 'cash',
        isPrimary: false,
    },
};

const getSignedAmount = (transactionType: BankTransactionType, amount: number) => (
    transactionType === 'credit' ? amount : -amount
);

const sanitizeAccountPayload = (data: Partial<Pick<IBankAccount, 'accountName' | 'bankName' | 'accountNumber' | 'ifscCode' | 'swiftCode' | 'notes' | 'accountType' | 'currency' | 'currentBalance' | 'isPrimary' | 'isActive'>>) => ({
    accountName: data.accountName?.trim(),
    bankName: data.bankName?.trim(),
    accountNumber: data.accountNumber?.trim(),
    ifscCode: data.ifscCode?.trim() || undefined,
    swiftCode: data.swiftCode?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    accountType: data.accountType,
    currency: data.currency,
    currentBalance: data.currentBalance,
    isPrimary: data.isPrimary,
    isActive: data.isActive,
});

export class BankTransactionService {
    static async ensureManagedAccounts(createdBy: Types.ObjectId): Promise<Record<BankAccountKey, IBankAccount>> {
        const accounts = {} as Record<BankAccountKey, IBankAccount>;

        for (const [accountKey, config] of Object.entries(MANAGED_ACCOUNTS) as Array<[BankAccountKey, (typeof MANAGED_ACCOUNTS)[BankAccountKey]]>) {
            const candidates = await BankAccount.find({
                $or: [
                    { accountKey },
                    { accountNumber: config.accountNumber },
                ],
            })
                .sort({ createdAt: 1, updatedAt: 1, _id: 1 })
                .exec();

            let account =
                candidates.find((candidate) => candidate.accountKey === accountKey)
                || candidates.find((candidate) => candidate.accountNumber === config.accountNumber)
                || null;

            if (!account) {
                account = await BankAccount.create({
                    accountKey,
                    accountName: config.accountName,
                    bankName: config.bankName,
                    accountNumber: config.accountNumber,
                    accountType: config.accountType,
                    currency: 'INR',
                    currentBalance: 0,
                    isActive: true,
                    isPrimary: config.isPrimary,
                    createdBy,
                });
                accounts[accountKey] = account;
                continue;
            }

            for (const duplicate of candidates) {
                if (duplicate._id.toString() === account._id.toString()) {
                    continue;
                }

                if (duplicate.accountKey === accountKey) {
                    duplicate.accountKey = undefined;
                    duplicate.updatedBy = createdBy;
                    await duplicate.save();
                }
            }

            if (account.accountKey !== accountKey) {
                account.accountKey = accountKey;
            }

            if (account.accountType !== config.accountType) {
                account.accountType = config.accountType;
            }

            if (!account.currency) {
                account.currency = 'INR';
            }

            account.updatedBy = createdBy;
            await account.save();

            accounts[accountKey] = account;
        }

        return accounts;
    }

    static async getManagedAccountDetails(userId: Types.ObjectId): Promise<IBankAccount[]> {
        const accounts = await this.ensureManagedAccounts(userId);
        return [accounts.hdfc_gst, accounts.sbi_non_gst, accounts.cash];
    }

    static async updateManagedAccountDetails(
        accountKey: BankAccountKey,
        data: Partial<Pick<IBankAccount, 'accountName' | 'bankName' | 'accountNumber' | 'ifscCode' | 'swiftCode' | 'notes' | 'isPrimary' | 'isActive'>> & { updatedBy: Types.ObjectId }
    ): Promise<IBankAccount | null> {
        const accounts = await this.ensureManagedAccounts(data.updatedBy);
        const account = accounts[accountKey];

        if (!account) {
            return null;
        }

        if (data.accountName !== undefined) account.accountName = data.accountName;
        if (data.bankName !== undefined) account.bankName = data.bankName;
        if (data.accountNumber !== undefined) account.accountNumber = data.accountNumber;
        if (data.ifscCode !== undefined) account.ifscCode = data.ifscCode || undefined;
        if (data.swiftCode !== undefined) account.swiftCode = data.swiftCode || undefined;
        if (data.notes !== undefined) account.notes = data.notes || undefined;
        if (data.isPrimary !== undefined) account.isPrimary = data.isPrimary;
        if (data.isActive !== undefined) account.isActive = data.isActive;
        account.updatedBy = data.updatedBy;

        await account.save();
        return account;
    }

    static async getOtherAccountDetails(userId: Types.ObjectId): Promise<IBankAccount[]> {
        await this.ensureManagedAccounts(userId);

        return BankAccount.find({
            $or: [{ accountKey: { $exists: false } }, { accountKey: null }],
        })
            .sort({ updatedAt: -1, createdAt: -1 })
            .exec();
    }

    static async createOtherAccount(
        data: Partial<Pick<IBankAccount, 'accountName' | 'bankName' | 'accountNumber' | 'ifscCode' | 'swiftCode' | 'notes' | 'accountType' | 'currency' | 'currentBalance' | 'isPrimary' | 'isActive'>> & { createdBy: Types.ObjectId }
    ): Promise<IBankAccount> {
        const account = await BankAccount.create({
            ...sanitizeAccountPayload(data),
            accountName: data.accountName?.trim(),
            bankName: data.bankName?.trim(),
            accountNumber: data.accountNumber?.trim(),
            accountType: data.accountType || 'current',
            currency: data.currency || 'USD',
            currentBalance: data.currentBalance ?? 0,
            isPrimary: data.isPrimary ?? false,
            isActive: data.isActive ?? true,
            createdBy: data.createdBy,
        });

        return account;
    }

    static async updateOtherAccount(
        id: string,
        data: Partial<Pick<IBankAccount, 'accountName' | 'bankName' | 'accountNumber' | 'ifscCode' | 'swiftCode' | 'notes' | 'accountType' | 'currency' | 'currentBalance' | 'isPrimary' | 'isActive'>> & { updatedBy: Types.ObjectId }
    ): Promise<IBankAccount | null> {
        const account = await BankAccount.findOne({ _id: id, $or: [{ accountKey: { $exists: false } }, { accountKey: null }] });

        if (!account) {
            return null;
        }

        const payload = sanitizeAccountPayload(data);

        if (payload.accountName !== undefined) account.accountName = payload.accountName;
        if (payload.bankName !== undefined) account.bankName = payload.bankName;
        if (payload.accountNumber !== undefined) account.accountNumber = payload.accountNumber;
        if (payload.ifscCode !== undefined) account.ifscCode = payload.ifscCode;
        if (payload.swiftCode !== undefined) account.swiftCode = payload.swiftCode;
        if (payload.notes !== undefined) account.notes = payload.notes;
        if (payload.accountType !== undefined) account.accountType = payload.accountType;
        if (payload.currency !== undefined) account.currency = payload.currency;
        if (payload.currentBalance !== undefined) account.currentBalance = payload.currentBalance;
        if (payload.isPrimary !== undefined) account.isPrimary = payload.isPrimary;
        if (payload.isActive !== undefined) account.isActive = payload.isActive;

        account.updatedBy = data.updatedBy;
        await account.save();
        return account;
    }

    static async deleteOtherAccount(id: string): Promise<boolean> {
        const deleted = await BankAccount.deleteOne({ _id: id, $or: [{ accountKey: { $exists: false } }, { accountKey: null }] });
        return deleted.deletedCount > 0;
    }

    static async create(data: CreateBankTransactionData): Promise<IBankTransaction> {
        const accounts = await this.ensureManagedAccounts(data.createdBy);
        const account = accounts[data.accountKey];

        const transaction = await BankTransaction.create({
            bankAccountId: account._id,
            accountKey: data.accountKey,
            accountName: account.accountName,
            transactionType: data.transactionType,
            amount: data.amount,
            date: data.date,
            description: data.description,
            referenceNumber: data.referenceNumber,
            notes: data.notes,
            source: data.source || 'manual',
            expenseId: data.expenseId,
            payrollId: data.payrollId,
            createdBy: data.createdBy,
        });

        account.currentBalance += getSignedAmount(data.transactionType, data.amount);
        await account.save();

        return transaction;
    }

    static async getAll(filters: BankTransactionFilters, userId: Types.ObjectId): Promise<{
        transactions: IBankTransaction[];
        total: number;
        summary: {
            totalCashInBank: number;
            totalCredit: number;
            totalDebit: number;
            accountBalances: Record<BankAccountKey, number>;
        };
    }> {
        await this.ensureManagedAccounts(userId);
        const query: FilterQuery<IBankTransaction> = {};

        if (filters.accountKey) {
            query.accountKey = filters.accountKey;
        }

        if (filters.transactionType) {
            query.transactionType = filters.transactionType;
        }

        if (filters.startDate || filters.endDate) {
            query.date = {};
            if (filters.startDate) query.date.$gte = filters.startDate;
            if (filters.endDate) query.date.$lte = filters.endDate;
        }

        if (filters.search) {
            const searchRegex = new RegExp(filters.search, 'i');
            query.$or = [
                { description: searchRegex },
                { accountName: searchRegex },
                { referenceNumber: searchRegex },
                { notes: searchRegex },
            ];
        }

        const page = filters.page || 1;
        const limit = filters.limit || 100;
        const skip = (page - 1) * limit;

        const [transactions, total, aggregates, balanceAggregates] = await Promise.all([
            BankTransaction.find(query)
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            BankTransaction.countDocuments(query),
            BankTransaction.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$transactionType',
                        total: { $sum: '$amount' },
                    },
                },
            ]),
            // Always derive account balances from the full transaction ledger
            // so stale account.currentBalance values do not cause mismatches.
            BankTransaction.aggregate([
                {
                    $group: {
                        _id: '$accountKey',
                        balance: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$transactionType', 'credit'] },
                                    '$amount',
                                    { $multiply: ['$amount', -1] },
                                ],
                            },
                        },
                    },
                },
            ]),
        ]);

        const totalCredit = aggregates.find((item) => item._id === 'credit')?.total || 0;
        const totalDebit = aggregates.find((item) => item._id === 'debit')?.total || 0;
        const accountBalances = {
            hdfc_gst: balanceAggregates.find((item) => item._id === 'hdfc_gst')?.balance ?? 0,
            sbi_non_gst: balanceAggregates.find((item) => item._id === 'sbi_non_gst')?.balance ?? 0,
            cash: balanceAggregates.find((item) => item._id === 'cash')?.balance ?? 0,
        };

        return {
            transactions: transactions as IBankTransaction[],
            total,
            summary: {
                totalCashInBank: Object.values(accountBalances).reduce((sum, balance) => sum + balance, 0),
                totalCredit,
                totalDebit,
                accountBalances,
            },
        };
    }

    static async getById(id: Types.ObjectId | string): Promise<IBankTransaction | null> {
        return BankTransaction.findById(id).lean();
    }

    static async update(
        id: Types.ObjectId | string,
        data: Partial<CreateBankTransactionData> & { updatedBy: Types.ObjectId }
    ): Promise<IBankTransaction | null> {
        const existing = await BankTransaction.findById(id);
        if (!existing) return null;

        const accounts = await this.ensureManagedAccounts(data.updatedBy);
        const oldAccount = accounts[existing.accountKey];
        const newAccountKey = data.accountKey || existing.accountKey;
        const newAccount = accounts[newAccountKey];
        const newTransactionType = data.transactionType || existing.transactionType;
        const newAmount = data.amount ?? existing.amount;

        oldAccount.currentBalance -= getSignedAmount(existing.transactionType, existing.amount);
        await oldAccount.save();

        newAccount.currentBalance += getSignedAmount(newTransactionType, newAmount);
        await newAccount.save();

        existing.bankAccountId = newAccount._id;
        existing.accountKey = newAccountKey;
        existing.accountName = newAccount.accountName;
        existing.transactionType = newTransactionType;
        existing.amount = newAmount;
        existing.date = data.date || existing.date;
        existing.description = data.description ?? existing.description;
        existing.referenceNumber = data.referenceNumber === '' ? undefined : (data.referenceNumber ?? existing.referenceNumber);
        existing.notes = data.notes === '' ? undefined : (data.notes ?? existing.notes);
        existing.source = data.source || existing.source;
        existing.updatedBy = data.updatedBy;

        await existing.save();
        return existing.toObject() as IBankTransaction;
    }

    static async delete(id: Types.ObjectId | string): Promise<boolean> {
        const existing = await BankTransaction.findById(id);
        if (!existing) return false;

        const account = await BankAccount.findById(existing.bankAccountId);
        if (account) {
            account.currentBalance -= getSignedAmount(existing.transactionType, existing.amount);
            await account.save();
        }

        await existing.deleteOne();
        return true;
    }
}
