import { FilterQuery, Types } from 'mongoose';
import { Expense, IExpense } from '../models/Expense.model';
import { ExpenseService } from './expense.service';
import { FixedExpense, IFixedExpense, FixedExpenseFrequency } from '../models/FixedExpense.model';
import {
    FixedExpenseApproval,
    IFixedExpenseApproval,
    FixedExpenseApprovalStatus,
} from '../models/FixedExpenseApproval.model';
import { notificationService } from '../../notification/services/notification.service';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';
import { EXPENSE_CATEGORIES } from '../constants/expenseCategories';

interface CreateFixedExpenseData {
    title: string;
    description: string;
    category: string;
    level: 'company' | 'project';
    amount: number;
    dueDay: number;
    frequency: FixedExpenseFrequency;
    startDate: Date;
    projectId?: Types.ObjectId;
    projectName?: string;
    vendor?: string;
    paidBy?: string;
    notes?: string;
    sourceAccountKey?: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
    isActive?: boolean;
    createdBy: Types.ObjectId;
}

interface FixedExpenseFilters {
    isActive?: boolean;
}

interface ApprovalFilters {
    status?: FixedExpenseApprovalStatus | 'all';
}

interface ApprovalActionData {
    amount?: number;
    paidDate?: Date;
    responseNotes?: string;
    description?: string;
    vendor?: string;
    paidBy?: string;
    notes?: string;
    sourceAccountKey?: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
}

const addMonths = (date: Date, months: number) =>
    new Date(date.getFullYear(), date.getMonth() + months, 1);

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getFrequencyStep = (frequency: FixedExpenseFrequency) => {
    if (frequency === 'quarterly') return 3;
    if (frequency === 'yearly') return 12;
    return 1;
};

const getDaysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

const getOccurrenceDate = (cursor: Date, dueDay: number) => {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const day = Math.min(dueDay, getDaysInMonth(year, monthIndex));
    return new Date(year, monthIndex, day);
};

const getPeriodKey = (cursor: Date, frequency: FixedExpenseFrequency) => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;

    if (frequency === 'yearly') {
        return `${year}`;
    }

    if (frequency === 'quarterly') {
        const quarter = Math.floor((month - 1) / 3) + 1;
        return `${year}-Q${quarter}`;
    }

    return `${year}-${String(month).padStart(2, '0')}`;
};

const getFirstCursor = (startDate: Date, dueDay: number, frequency: FixedExpenseFrequency) => {
    const normalizedStartDate = startOfDay(startDate);
    let cursor = new Date(normalizedStartDate.getFullYear(), normalizedStartDate.getMonth(), 1);
    let dueDate = getOccurrenceDate(cursor, dueDay);

    while (dueDate < normalizedStartDate) {
        cursor = addMonths(cursor, getFrequencyStep(frequency));
        dueDate = getOccurrenceDate(cursor, dueDay);
    }

    return cursor;
};

export class FixedExpenseService {
    private static getArchiveBatchId(options: ArchiveDeleteOptions = {}): string {
        return options.archiveBatchId ?? DeletedRecordService.generateArchiveBatchId();
    }

    static async create(data: CreateFixedExpenseData): Promise<IFixedExpense> {
        const fixedExpense = new FixedExpense({
            ...data,
            type: 'fixed',
        });
        return fixedExpense.save();
    }

    static async getAll(filters: FixedExpenseFilters = {}): Promise<IFixedExpense[]> {
        const query: FilterQuery<IFixedExpense> = {};

        if (filters.isActive !== undefined) {
            query.isActive = filters.isActive;
        }

        return FixedExpense.find(query).sort({ isActive: -1, createdAt: -1 }).lean();
    }

    static async update(
        id: Types.ObjectId | string,
        data: Partial<CreateFixedExpenseData> & { updatedBy: Types.ObjectId }
    ): Promise<IFixedExpense | null> {
        return FixedExpense.findByIdAndUpdate(
            id,
            {
                ...data,
                type: 'fixed',
            },
            { new: true }
        ).lean();
    }

    static async delete(id: Types.ObjectId | string, options: ArchiveDeleteOptions = {}): Promise<boolean> {
        const fixedExpense = await FixedExpense.findById(id);
        if (!fixedExpense) return false;

        const archiveBatchId = this.getArchiveBatchId(options);
        const pendingApprovals = await FixedExpenseApproval.find({
            fixedExpenseId: fixedExpense._id,
            status: 'pending',
        });

        if (!options.skipArchive) {
            await DeletedRecordService.archiveDocument(fixedExpense, {
                archiveBatchId,
                deletedBy: options.deletedBy,
                reason: options.reason ?? 'Fixed expense delete requested',
                operation: 'delete',
                session: options.session,
                metadata: {
                    ...options.metadata,
                    fixedExpenseId: fixedExpense._id.toString(),
                    projectId: fixedExpense.projectId?.toString(),
                    sourceAccountKey: fixedExpense.sourceAccountKey,
                },
            });

            await DeletedRecordService.archiveDocuments(pendingApprovals, {
                archiveBatchId,
                deletedBy: options.deletedBy,
                reason: options.reason ?? 'Fixed expense delete requested',
                operation: 'cascade_delete',
                session: options.session,
                metadata: {
                    ...options.metadata,
                    fixedExpenseId: fixedExpense._id.toString(),
                    linkedFrom: 'FixedExpense',
                    pendingOnly: true,
                },
            });
        }

        await FixedExpenseApproval.deleteMany(
            {
                _id: { $in: pendingApprovals.map((approval) => approval._id) },
            },
            options.session ? { session: options.session } : undefined
        );
        await fixedExpense.deleteOne(options.session ? { session: options.session } : undefined);

        return true;
    }

    static async ensureApprovalRequestsUpToDate(referenceDate = new Date()): Promise<void> {
        const normalizedReferenceDate = startOfDay(referenceDate);
        const fixedExpenses = await FixedExpense.find({ isActive: true }).lean();

        for (const fixedExpense of fixedExpenses) {
            let cursor = getFirstCursor(new Date(fixedExpense.startDate), fixedExpense.dueDay, fixedExpense.frequency);
            let guard = 0;

            while (guard < 240) {
                const dueDate = getOccurrenceDate(cursor, fixedExpense.dueDay);
                if (dueDate > normalizedReferenceDate) break;

                const periodKey = getPeriodKey(cursor, fixedExpense.frequency);

                const created = await FixedExpenseApproval.updateOne(
                    {
                        fixedExpenseId: fixedExpense._id,
                        periodKey,
                    },
                    {
                        $setOnInsert: {
                            fixedExpenseId: fixedExpense._id,
                            periodKey,
                            dueDate,
                            status: 'pending',
                            title: fixedExpense.title,
                            description: fixedExpense.description,
                            category: fixedExpense.category,
                            level: fixedExpense.level,
                            type: 'fixed',
                            amount: fixedExpense.amount,
                            frequency: fixedExpense.frequency,
                            dueDay: fixedExpense.dueDay,
                            projectId: fixedExpense.projectId,
                            projectName: fixedExpense.projectName,
                            vendor: fixedExpense.vendor,
                            paidBy: fixedExpense.paidBy,
                            sourceAccountKey: fixedExpense.sourceAccountKey,
                            notes: fixedExpense.notes,
                        },
                    },
                    {
                        upsert: true,
                    }
                );

                if (created.upsertedCount > 0) {
                    await notificationService.notifySuperadmins({
                        type: 'fixed_expense_approval',
                        title: 'Fixed expense approval pending',
                        message: `${fixedExpense.title} is due on ${dueDate.toLocaleDateString('en-IN')} and is waiting for approval.`,
                        link: '/finance/expenses',
                        metadata: {
                            fixedExpenseId: fixedExpense._id.toString(),
                            periodKey,
                            dueDate: dueDate.toISOString(),
                        },
                    });
                }

                cursor = addMonths(cursor, getFrequencyStep(fixedExpense.frequency));
                guard += 1;
            }
        }
    }

    static async getApprovals(filters: ApprovalFilters = {}): Promise<{
        approvals: IFixedExpenseApproval[];
        pendingCount: number;
    }> {
        await this.ensureApprovalRequestsUpToDate();

        const query: FilterQuery<IFixedExpenseApproval> = {};
        if (filters.status && filters.status !== 'all') {
            query.status = filters.status;
        }

        const [approvals, pendingCount] = await Promise.all([
            FixedExpenseApproval.find(query).sort({ status: 1, dueDate: 1, createdAt: -1 }).lean(),
            FixedExpenseApproval.countDocuments({ status: 'pending' }),
        ]);

        return { approvals: approvals as IFixedExpenseApproval[], pendingCount };
    }

    static async getTransactions(): Promise<IExpense[]> {
        const expenses = await Expense.find({
            type: 'fixed',
            isRecurring: true,
        })
            .sort({ date: -1, createdAt: -1 })
            .lean();

        return expenses as IExpense[];
    }

    static async approve(
        approvalId: Types.ObjectId | string,
        data: ApprovalActionData,
        userId: Types.ObjectId
    ): Promise<IFixedExpenseApproval | null> {
        const approval = await FixedExpenseApproval.findById(approvalId);

        if (!approval) return null;
        if (approval.status !== 'pending') return approval.toObject() as IFixedExpenseApproval;

        const category = EXPENSE_CATEGORIES.includes(approval.category as any)
            ? approval.category
            : 'Other';

        const expense = await ExpenseService.create({
            date: data.paidDate || approval.dueDate,
            description: data.description || approval.description,
            category,
            level: approval.level,
            type: 'fixed',
            amount: data.amount ?? approval.amount,
            projectId: approval.projectId,
            projectName: approval.projectName,
            vendor: data.vendor ?? approval.vendor,
            paidBy: data.paidBy ?? approval.paidBy,
            sourceAccountKey: data.sourceAccountKey ?? approval.sourceAccountKey,
            notes: data.notes ?? approval.notes,
            isRecurring: true,
            recurringFrequency: approval.frequency,
            createdBy: userId,
        });

        approval.status = 'approved';
        approval.amount = data.amount ?? approval.amount;
        approval.description = data.description || approval.description;
        approval.vendor = data.vendor ?? approval.vendor;
        approval.paidBy = data.paidBy ?? approval.paidBy;
        approval.sourceAccountKey = data.sourceAccountKey ?? approval.sourceAccountKey;
        approval.notes = data.notes ?? approval.notes;
        approval.responseNotes = data.responseNotes;
        approval.paidDate = data.paidDate || approval.dueDate;
        approval.approvedExpenseId = expense._id;
        approval.actedBy = userId;
        approval.actedAt = new Date();
        await approval.save();

        return approval.toObject() as IFixedExpenseApproval;
    }

    static async reject(
        approvalId: Types.ObjectId | string,
        data: ApprovalActionData,
        userId: Types.ObjectId
    ): Promise<IFixedExpenseApproval | null> {
        const approval = await FixedExpenseApproval.findById(approvalId);

        if (!approval) return null;
        if (approval.status !== 'pending') return approval.toObject() as IFixedExpenseApproval;

        approval.status = 'rejected';
        approval.amount = data.amount ?? approval.amount;
        approval.description = data.description || approval.description;
        approval.vendor = data.vendor ?? approval.vendor;
        approval.paidBy = data.paidBy ?? approval.paidBy;
        approval.sourceAccountKey = data.sourceAccountKey ?? approval.sourceAccountKey;
        approval.notes = data.notes ?? approval.notes;
        approval.responseNotes = data.responseNotes;
        approval.paidDate = data.paidDate;
        approval.actedBy = userId;
        approval.actedAt = new Date();
        await approval.save();

        return approval.toObject() as IFixedExpenseApproval;
    }
}
