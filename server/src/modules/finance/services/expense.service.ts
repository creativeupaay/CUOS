import { Expense, IExpense } from '../models/Expense.model';
import { BankTransactionService } from './bankTransaction.service';
import type { BankAccountKey } from '../models/BankTransaction.model';
import { Payroll } from '../../hrms/models/Payroll.model';
import { Employee } from '../../hrms/models/Employee.model';
import { TimeLog } from '../../project/models/TimeLog.model';
import { Project } from '../../project/models/Project.model';
import { Types, FilterQuery } from 'mongoose';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';
import { BankTransaction } from '../models/BankTransaction.model';

interface CreateExpenseData {
    date: Date;
    description: string;
    category: string;
    level: 'company' | 'project';
    type: 'fixed' | 'variable';
    amount: number;
    projectId?: Types.ObjectId;
    projectName?: string;
    employeeId?: Types.ObjectId;
    employeeName?: string;
    vendor?: string;
    paidBy?: string;
    sourceAccountKey?: BankAccountKey;
    isRecurring?: boolean;
    recurringFrequency?: 'monthly' | 'quarterly' | 'yearly';
    notes?: string;
    createdBy: Types.ObjectId;
}

interface ExpenseFilters {
    level?: string;
    type?: string;
    category?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    projectId?: Types.ObjectId;
    employeeId?: Types.ObjectId;
    isRecurring?: boolean;
    page?: number;
    limit?: number;
}

interface UpdateExpenseData extends Partial<CreateExpenseData> {
    updatedBy: Types.ObjectId;
}

export class ExpenseService {
    private static getArchiveBatchId(options: ArchiveDeleteOptions = {}): string {
        return options.archiveBatchId ?? DeletedRecordService.generateArchiveBatchId();
    }

    static async upsertPayrollSalaryExpense(params: {
        payrollId: Types.ObjectId;
        employeeId: Types.ObjectId;
        employeeName: string;
        month: number;
        year: number;
        amount: number;
        paidAt?: Date;
        sourceAccountKey?: BankAccountKey;
        bankTransactionId?: Types.ObjectId;
        createdBy: Types.ObjectId;
        updatedBy?: Types.ObjectId;
    }): Promise<IExpense> {
        const expenseDate = params.paidAt || new Date(params.year, params.month - 1, 28);
        const description = `Salary payout - ${params.employeeName} (${new Date(params.year, params.month - 1, 1).toLocaleString('en-US', { month: 'short' })} ${params.year})`;

        let expense = await Expense.findOne({
            payrollId: params.payrollId,
            level: 'company',
            category: 'Salaries',
        });

        if (!expense) {
            expense = await Expense.create({
                date: expenseDate,
                description,
                category: 'Salaries',
                level: 'company',
                type: 'fixed',
                amount: params.amount,
                employeeId: params.employeeId,
                employeeName: params.employeeName,
                payrollId: params.payrollId,
                sourceAccountKey: params.sourceAccountKey,
                bankTransactionId: params.bankTransactionId,
                isRecurring: false,
                isSynced: true,
                notes: `Auto-created from payroll ${params.month}/${params.year}`,
                createdBy: params.createdBy,
            });

            return expense;
        }

        expense.date = expenseDate;
        expense.description = description;
        expense.amount = params.amount;
        expense.employeeId = params.employeeId;
        expense.employeeName = params.employeeName;
        expense.sourceAccountKey = params.sourceAccountKey;
        expense.bankTransactionId = params.bankTransactionId;
        expense.isSynced = true;
        expense.updatedBy = params.updatedBy || params.createdBy;
        expense.notes = `Auto-synced from payroll ${params.month}/${params.year}`;
        await expense.save();

        return expense;
    }

    /**
     * Create a new expense entry
     */
    static async create(data: CreateExpenseData): Promise<IExpense> {
        const expense = new Expense(data);
        await expense.save();

        if (data.sourceAccountKey) {
            const bankTransaction = await BankTransactionService.create({
                accountKey: data.sourceAccountKey,
                transactionType: 'debit',
                amount: data.amount,
                date: data.date,
                description: data.description,
                notes: data.notes,
                source: 'automatic',
                expenseId: expense._id,
                createdBy: data.createdBy,
            });

            expense.bankTransactionId = bankTransaction._id;
            await expense.save();
        }

        return expense;
    }

    /**
     * Get all expenses with filters
     */
    static async getAll(filters: ExpenseFilters): Promise<{ expenses: IExpense[]; total: number }> {
        const query: FilterQuery<IExpense> = {};

        if (filters.level) {
            query.level = filters.level;
        }

        if (filters.type) {
            query.type = filters.type;
        }

        if (filters.category) {
            query.category = filters.category;
        }

        if (filters.projectId) {
            query.projectId = filters.projectId;
        }

        if (filters.employeeId) {
            query.employeeId = filters.employeeId;
        }

        if (filters.isRecurring !== undefined) {
            query.isRecurring = filters.isRecurring;
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
                { category: searchRegex },
                { vendor: searchRegex },
                { projectName: searchRegex },
                { employeeName: searchRegex },
            ];
        }

        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const skip = (page - 1) * limit;

        const [expenses, total] = await Promise.all([
            Expense.find(query)
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Expense.countDocuments(query),
        ]);

        return { expenses: expenses as IExpense[], total };
    }

    /**
     * Get expense by ID
     */
    static async getById(id: Types.ObjectId | string): Promise<IExpense | null> {
        return Expense.findById(id).lean();
    }

    /**
     * Update expense
     */
    static async update(
        id: Types.ObjectId | string,
        data: UpdateExpenseData
    ): Promise<IExpense | null> {
        const existing = await Expense.findById(id);
        if (!existing) return null;

        const previousTransactionId = existing.bankTransactionId;

        Object.assign(existing, data);
        await existing.save();

        if (existing.sourceAccountKey) {
            const transactionPayload = {
                accountKey: existing.sourceAccountKey,
                transactionType: 'debit' as const,
                amount: existing.amount,
                date: existing.date,
                description: existing.description,
                notes: existing.notes,
                source: 'automatic' as const,
                expenseId: existing._id,
                updatedBy: data.updatedBy,
                createdBy: existing.createdBy,
            };

            if (previousTransactionId) {
                await BankTransactionService.update(previousTransactionId, transactionPayload);
                existing.bankTransactionId = previousTransactionId as any;
                await existing.save();
            } else {
                const bankTransaction = await BankTransactionService.create(transactionPayload);
                existing.bankTransactionId = bankTransaction._id;
                await existing.save();
            }
        } else if (previousTransactionId) {
            await BankTransactionService.delete(previousTransactionId, {
                deletedBy: data.updatedBy,
                reason: 'Expense update removed source account',
                metadata: {
                    expenseId: existing._id.toString(),
                },
            });
            existing.bankTransactionId = undefined;
            await existing.save();
        }

        return existing.toObject() as IExpense;
    }

    /**
     * Delete expense
     */
    static async delete(id: Types.ObjectId | string, options: ArchiveDeleteOptions = {}): Promise<boolean> {
        const expense = await Expense.findById(id);
        if (!expense) return false;

        const archiveBatchId = this.getArchiveBatchId(options);
        const linkedTransactions = await BankTransaction.find({
            $or: [
                { expenseId: expense._id },
                ...(expense.bankTransactionId ? [{ _id: expense.bankTransactionId }] : []),
            ],
        });

        if (!options.skipArchive) {
            await DeletedRecordService.archiveDocument(expense, {
                archiveBatchId,
                deletedBy: options.deletedBy,
                reason: options.reason ?? 'Expense delete requested',
                operation: 'delete',
                session: options.session,
                metadata: {
                    ...options.metadata,
                    expenseId: expense._id.toString(),
                    bankTransactionId: expense.bankTransactionId?.toString(),
                    payrollId: expense.payrollId?.toString(),
                    projectId: expense.projectId?.toString(),
                    employeeId: expense.employeeId?.toString(),
                },
            });

            await DeletedRecordService.archiveDocuments(linkedTransactions, {
                archiveBatchId,
                deletedBy: options.deletedBy,
                reason: options.reason ?? 'Expense delete requested',
                operation: 'delete',
                session: options.session,
                metadata: {
                    ...options.metadata,
                    expenseId: expense._id.toString(),
                    linkedFrom: 'Expense',
                },
            });
        }

        for (const transaction of linkedTransactions) {
            await BankTransactionService.delete(transaction._id, {
                ...options,
                archiveBatchId,
                skipArchive: true,
            });
        }

        await expense.deleteOne(options.session ? { session: options.session } : undefined);
        return true;
    }

    /**
     * Sync salaries from payroll for a specific month
     * This calculates salary expenses and distributes them to projects based on time worked
     */
    static async syncSalaryExpenses(
        month: number,
        year: number,
        createdBy: Types.ObjectId
    ): Promise<{ synced: number; errors: string[] }> {
        const errors: string[] = [];
        let synced = 0;

        // Get all paid payrolls for the month
        const payrolls = await Payroll.find({
            month,
            year,
            status: 'paid',
        }).populate('employeeId');

        // Get date range for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        for (const payroll of payrolls) {
            try {
                const employee = payroll.employeeId as any;
                if (!employee) continue;

                // Check if already synced
                const existingExpense = await Expense.findOne({
                    payrollId: payroll._id,
                    isSynced: true,
                });

                if (existingExpense) {
                    continue; // Already synced
                }

                // Get time logs for this employee in this month
                const timeLogs = await TimeLog.find({
                    userId: employee.userId,
                    date: { $gte: startDate, $lte: endDate },
                });

                // Calculate total hours worked
                const totalMinutes = timeLogs.reduce((sum, log) => sum + log.duration, 0);
                const totalHours = totalMinutes / 60;

                // Group time by project
                const projectHoursMap = new Map<string, { hours: number; projectId: Types.ObjectId }>();
                for (const log of timeLogs) {
                    const key = log.projectId.toString();
                    const existing = projectHoursMap.get(key) || { hours: 0, projectId: log.projectId };
                    existing.hours += log.duration / 60;
                    projectHoursMap.set(key, existing);
                }

                const netSalary = payroll.netSalary;

                if (projectHoursMap.size === 0) {
                    // No project time logged - create company level expense
                    await Expense.create({
                        date: new Date(year, month - 1, 28), // End of month
                        description: `Salary - ${employee.firstName} ${employee.lastName} (${month}/${year}) - No project allocation`,
                        category: 'Salaries',
                        level: 'company',
                        type: 'fixed',
                        amount: netSalary,
                        employeeId: employee._id,
                        employeeName: `${employee.firstName} ${employee.lastName}`,
                        payrollId: payroll._id,
                        isSynced: true,
                        totalMonthlyHours: totalHours,
                        createdBy,
                    });
                    synced++;
                } else {
                    // Distribute salary across projects based on hours
                    for (const [projectIdStr, { hours, projectId }] of projectHoursMap) {
                        const percentage = (hours / totalHours) * 100;
                        const allocatedAmount = Math.round((netSalary * hours) / totalHours);

                        // Get project name
                        const project = await Project.findById(projectId).select('name').lean();

                        await Expense.create({
                            date: new Date(year, month - 1, 28),
                            description: `Salary Allocation - ${employee.firstName} ${employee.lastName} (${month}/${year})`,
                            category: 'Salaries',
                            level: 'project',
                            type: 'fixed',
                            amount: allocatedAmount,
                            projectId,
                            projectName: project?.name || 'Unknown Project',
                            employeeId: employee._id,
                            employeeName: `${employee.firstName} ${employee.lastName}`,
                            payrollId: payroll._id,
                            isSynced: true,
                            isAllocated: true,
                            allocationPercentage: Math.round(percentage * 100) / 100,
                            totalMonthlyHours: totalHours,
                            projectHours: hours,
                            createdBy,
                        });
                        synced++;
                    }
                }
            } catch (error: any) {
                errors.push(`Failed to sync payroll ${payroll._id}: ${error.message}`);
            }
        }

        return { synced, errors };
    }

    /**
     * Get expense summary for date range
     */
    static async getSummary(startDate: Date, endDate: Date): Promise<{
        totalExpense: number;
        byLevel: Record<string, number>;
        byType: Record<string, number>;
        byCategory: Record<string, number>;
        salaryExpense: number;
        projectExpense: number;
    }> {
        const expenses = await Expense.find({
            date: { $gte: startDate, $lte: endDate },
        }).lean();

        const summary = {
            totalExpense: 0,
            byLevel: {} as Record<string, number>,
            byType: {} as Record<string, number>,
            byCategory: {} as Record<string, number>,
            salaryExpense: 0,
            projectExpense: 0,
        };

        for (const exp of expenses) {
            summary.totalExpense += exp.amount;
            summary.byLevel[exp.level] = (summary.byLevel[exp.level] || 0) + exp.amount;
            summary.byType[exp.type] = (summary.byType[exp.type] || 0) + exp.amount;
            summary.byCategory[exp.category] = (summary.byCategory[exp.category] || 0) + exp.amount;

            if (exp.category === 'Salaries') {
                summary.salaryExpense += exp.amount;
            }
            if (exp.level === 'project') {
                summary.projectExpense += exp.amount;
            }
        }

        return summary;
    }

    /**
     * Get monthly expense data for charts
     */
    static async getMonthlyData(startDate: Date, endDate: Date): Promise<{
        month: string;
        expense: number;
        fixed: number;
        variable: number;
        salaries: number;
    }[]> {
        const result = await Expense.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                    },
                    expense: { $sum: '$amount' },
                    fixed: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'fixed'] }, '$amount', 0],
                        },
                    },
                    variable: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'variable'] }, '$amount', 0],
                        },
                    },
                    salaries: {
                        $sum: {
                            $cond: [{ $eq: ['$category', 'Salaries'] }, '$amount', 0],
                        },
                    },
                },
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 },
            },
        ]);

        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        return result.map((r) => ({
            month: `${monthNames[r._id.month]} ${r._id.year}`,
            expense: r.expense,
            fixed: r.fixed,
            variable: r.variable,
            salaries: r.salaries,
        }));
    }

    /**
     * Get project expense summary
     */
    static async getProjectExpenseSummary(
        startDate: Date,
        endDate: Date
    ): Promise<{
        projectId: string;
        projectName: string;
        totalExpense: number;
        salaryExpense: number;
        otherExpense: number;
    }[]> {
        const result = await Expense.aggregate([
            {
                $match: {
                    level: 'project',
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: '$projectId',
                    projectName: { $first: '$projectName' },
                    totalExpense: { $sum: '$amount' },
                    salaryExpense: {
                        $sum: {
                            $cond: [{ $eq: ['$category', 'Salaries'] }, '$amount', 0],
                        },
                    },
                    otherExpense: {
                        $sum: {
                            $cond: [{ $ne: ['$category', 'Salaries'] }, '$amount', 0],
                        },
                    },
                },
            },
            {
                $sort: { totalExpense: -1 },
            },
        ]);

        return result.map((r) => ({
            projectId: r._id?.toString() || '',
            projectName: r.projectName || 'Unknown Project',
            totalExpense: r.totalExpense,
            salaryExpense: r.salaryExpense,
            otherExpense: r.otherExpense,
        }));
    }
}
