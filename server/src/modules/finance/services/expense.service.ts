import { Expense, IExpense } from '../models/Expense.model';
import AppError from '../../../utils/appError';

interface ExpenseFilters {
    category?: string;
    projectId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

/**
 * Create a new expense
 */
export const createExpense = async (
    data: Partial<IExpense>,
    userId: string
): Promise<IExpense> => {
    const expense = await Expense.create({
        ...data,
        createdBy: userId,
    });
    return expense;
};

/**
 * Get all expenses with filters
 */
export const getExpenses = async (filters: ExpenseFilters) => {
    const { category, projectId, status, startDate, endDate, page = 1, limit = 20 } = filters;

    const query: any = {};
    if (category) query.category = category;
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;
    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }

    const total = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
        .populate('projectId', 'name')
        .populate('employeeId', 'employeeId designation')
        .populate('createdBy', 'name')
        .populate('approvedBy', 'name')
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    return {
        expenses,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};

/**
 * Get expense by ID
 */
export const getExpenseById = async (id: string): Promise<IExpense> => {
    const expense = await Expense.findById(id)
        .populate('projectId', 'name')
        .populate('employeeId', 'employeeId designation')
        .populate('createdBy', 'name')
        .populate('approvedBy', 'name');

    if (!expense) throw new AppError('Expense not found', 404);
    return expense;
};

/**
 * Update an expense
 */
export const updateExpense = async (
    id: string,
    data: Partial<IExpense>
): Promise<IExpense> => {
    const expense = await Expense.findById(id);
    if (!expense) throw new AppError('Expense not found', 404);

    Object.assign(expense, data);
    await expense.save();
    return expense;
};

/**
 * Delete an expense
 */
export const deleteExpense = async (id: string): Promise<void> => {
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) throw new AppError('Expense not found', 404);
};

/**
 * Approve an expense
 */
export const approveExpense = async (
    id: string,
    userId: string
): Promise<IExpense> => {
    const expense = await Expense.findById(id);
    if (!expense) throw new AppError('Expense not found', 404);

    expense.status = 'approved';
    expense.approvedBy = userId as any;
    expense.approvedAt = new Date();
    await expense.save();
    return expense;
};

/**
 * Get expenses aggregated by category for a date range
 */
export const getExpensesByCategory = async (startDate: string, endDate: string) => {
    const result = await Expense.aggregate([
        {
            $match: {
                date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                },
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: '$category',
                totalAmount: { $sum: '$amountInBaseCurrency' },
                totalGst: { $sum: '$gstAmount' },
                totalTds: { $sum: '$tdsAmount' },
                count: { $sum: 1 },
            },
        },
        { $sort: { totalAmount: -1 } },
    ]);

    return result;
};

/**
 * Get monthly expense totals for a year
 */
export const getMonthlyExpenses = async (year: number) => {
    const result = await Expense.aggregate([
        {
            $match: {
                date: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31`),
                },
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: { month: { $month: '$date' }, category: '$category' },
                total: { $sum: '$amountInBaseCurrency' },
            },
        },
        {
            $group: {
                _id: '$_id.month',
                categories: {
                    $push: { category: '$_id.category', total: '$total' },
                },
                totalExpenses: { $sum: '$total' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return result;
};
