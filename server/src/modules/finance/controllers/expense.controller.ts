import { Request, Response } from 'express';
import { ExpenseService } from '../services/expense.service';
import { Types } from 'mongoose';
import { logger } from "../../../utils/logger";

const getAuthenticatedUserId = (req: Request) => (req as any).user?.id ?? (req as any).user?._id;

export class ExpenseController {
    /**
     * Create a new expense entry
     */
    static async create(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);

            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Not authenticated',
                });
                return;
            }

            // Transform the data to handle frontend inconsistencies
            const expenseData = {
                ...req.body,
                createdBy: new Types.ObjectId(userId),
                date: new Date(req.body.date), // Convert string to Date
                amount: parseFloat(req.body.amount), // Ensure amount is a number
            };

            // Remove empty string fields that should be undefined
            if (expenseData.projectId === '') delete expenseData.projectId;
            if (expenseData.projectName === '') delete expenseData.projectName;
            if (expenseData.employeeId === '') delete expenseData.employeeId;
            if (expenseData.employeeName === '') delete expenseData.employeeName;
            if (expenseData.vendor === '') delete expenseData.vendor;
            if (expenseData.paidBy === '') delete expenseData.paidBy;
            if (expenseData.sourceAccountKey === '') delete expenseData.sourceAccountKey;
            if (expenseData.notes === '') delete expenseData.notes;
            if (expenseData.transactionRef === '') delete expenseData.transactionRef;

            // Handle recurring frequency
            if (!expenseData.isRecurring) {
                delete expenseData.recurringFrequency;
            }

            const expense = await ExpenseService.create(expenseData);

            res.status(201).json({
                success: true,
                message: 'Expense entry created successfully',
                data: expense,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error creating expense:');
            res.status(500).json({
                success: false,
                message: 'Failed to create expense entry',
                error: error.message,
            });
        }
    }

    /**
     * Get all expenses with filters
     */
    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const filters = {
                level: req.query.level as string,
                type: req.query.type as string,
                category: req.query.category as string,
                search: req.query.search as string,
                startDate: req.query.startDate ? new Date(`${req.query.startDate}T00:00:00.000+05:30`) : undefined,
                endDate: req.query.endDate ? new Date(`${req.query.endDate}T23:59:59.999+05:30`) : undefined,
                projectId: req.query.projectId ? new Types.ObjectId(req.query.projectId as string) : undefined,
                employeeId: req.query.employeeId ? new Types.ObjectId(req.query.employeeId as string) : undefined,
                isRecurring: req.query.isRecurring !== undefined
                    ? String(req.query.isRecurring).toLowerCase() === 'true'
                    : undefined,
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
            };

            const result = await ExpenseService.getAll(filters);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching expenses:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch expenses',
                error: error.message,
            });
        }
    }

    /**
     * Get expense by ID
     */
    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const expense = await ExpenseService.getById(req.params.id);

            if (!expense) {
                res.status(404).json({
                    success: false,
                    message: 'Expense entry not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: expense,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching expense:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch expense',
                error: error.message,
            });
        }
    }

    /**
     * Update expense
     */
    static async update(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);

            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Not authenticated',
                });
                return;
            }

            // Transform the data to handle frontend inconsistencies
            const expenseData = {
                ...req.body,
                updatedBy: new Types.ObjectId(userId),
            };

            // Convert date if provided
            if (expenseData.date) {
                expenseData.date = new Date(expenseData.date);
            }

            // Ensure amount is a number if provided
            if (expenseData.amount !== undefined) {
                expenseData.amount = parseFloat(expenseData.amount);
            }

            // Remove empty string fields that should be undefined
            if (expenseData.projectId === '') delete expenseData.projectId;
            if (expenseData.projectName === '') delete expenseData.projectName;
            if (expenseData.employeeId === '') delete expenseData.employeeId;
            if (expenseData.employeeName === '') delete expenseData.employeeName;
            if (expenseData.vendor === '') delete expenseData.vendor;
            if (expenseData.paidBy === '') delete expenseData.paidBy;
            if (expenseData.sourceAccountKey === '') delete expenseData.sourceAccountKey;
            if (expenseData.notes === '') delete expenseData.notes;
            if (expenseData.transactionRef === '') delete expenseData.transactionRef;

            // Handle recurring frequency
            if (!expenseData.isRecurring) {
                delete expenseData.recurringFrequency;
            }

            const expense = await ExpenseService.update(req.params.id, expenseData);

            if (!expense) {
                res.status(404).json({
                    success: false,
                    message: 'Expense entry not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Expense entry updated successfully',
                data: expense,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error updating expense:');
            res.status(500).json({
                success: false,
                message: 'Failed to update expense',
                error: error.message,
            });
        }
    }

    /**
     * Delete expense
     */
    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            const deleted = await ExpenseService.delete(req.params.id, {
                deletedBy: userId,
                reason: 'Expense delete requested from finance module',
            });

            if (!deleted) {
                res.status(404).json({
                    success: false,
                    message: 'Expense entry not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Expense entry deleted successfully',
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error deleting expense:');
            res.status(500).json({
                success: false,
                message: 'Failed to delete expense',
                error: error.message,
            });
        }
    }

    /**
     * Sync salary expenses from payroll
     */
    static async syncSalaries(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            const { month, year } = req.body;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Not authenticated',
                });
                return;
            }

            if (!month || !year) {
                res.status(400).json({
                    success: false,
                    message: 'Month and year are required',
                });
                return;
            }

            const result = await ExpenseService.syncSalaryExpenses(month, year, userId);

            res.status(200).json({
                success: true,
                message: `Successfully synced ${result.synced} salary expenses`,
                data: result,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error syncing salaries:');
            res.status(500).json({
                success: false,
                message: 'Failed to sync salary expenses',
                error: error.message,
            });
        }
    }

    /**
     * Get project expense summary
     */
    static async getProjectExpenseSummary(req: Request, res: Response): Promise<void> {
        try {
            const startDate = req.query.startDate
                ? new Date(`${req.query.startDate}T00:00:00.000+05:30`)
                : new Date(new Date().getFullYear(), 0, 1);
            const endDate = req.query.endDate
                ? new Date(`${req.query.endDate}T23:59:59.999+05:30`)
                : new Date();

            const summary = await ExpenseService.getProjectExpenseSummary(startDate, endDate);

            res.status(200).json({
                success: true,
                data: summary,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching project expense summary:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch project expense summary',
                error: error.message,
            });
        }
    }
}
