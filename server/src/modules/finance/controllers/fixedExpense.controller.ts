import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { FixedExpenseService } from '../services/fixedExpense.service';
import { logger } from "../../../utils/logger";

const getAuthenticatedUserId = (req: Request) => (req as any).user?.id ?? (req as any).user?._id;

const cleanOptionalFields = (payload: Record<string, any>) => {
    if (payload.projectId === '') delete payload.projectId;
    if (payload.projectName === '') delete payload.projectName;
    if (payload.vendor === '') delete payload.vendor;
    if (payload.paidBy === '') delete payload.paidBy;
    if (payload.sourceAccountKey === '') delete payload.sourceAccountKey;
    if (payload.notes === '') delete payload.notes;
    if (payload.responseNotes === '') delete payload.responseNotes;
    if (payload.description === '') delete payload.description;
};

export class FixedExpenseController {
    static async create(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);

            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const expenseDateRaw = req.body.expenseDate || req.body.startDate;
            const expenseDate = expenseDateRaw ? new Date(expenseDateRaw) : null;

            const payload: Record<string, any> = {
                ...req.body,
                createdBy: new Types.ObjectId(userId),
                startDate: expenseDate || new Date(),
                amount: parseFloat(req.body.amount),
                dueDay: expenseDate ? expenseDate.getDate() : parseInt(req.body.dueDay, 10),
            };

            if ('expenseDate' in payload) delete payload.expenseDate;

            if (payload.projectId) {
                payload.projectId = new Types.ObjectId(payload.projectId);
            }

            cleanOptionalFields(payload);

            const fixedExpense = await FixedExpenseService.create(payload as any);

            res.status(201).json({
                success: true,
                message: 'Fixed expense created successfully',
                data: fixedExpense,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error creating fixed expense:');
            res.status(500).json({
                success: false,
                message: 'Failed to create fixed expense',
                error: error.message,
            });
        }
    }

    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const isActive =
                req.query.isActive === undefined
                    ? undefined
                    : String(req.query.isActive).toLowerCase() === 'true';

            const fixedExpenses = await FixedExpenseService.getAll({ isActive });

            res.status(200).json({
                success: true,
                data: fixedExpenses,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching fixed expenses:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch fixed expenses',
                error: error.message,
            });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);

            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const payload: Record<string, any> = {
                ...req.body,
                updatedBy: new Types.ObjectId(userId),
            };

            if (payload.expenseDate) {
                payload.startDate = new Date(payload.expenseDate);
                payload.dueDay = payload.startDate.getDate();
                delete payload.expenseDate;
            }
            if (payload.startDate) payload.startDate = new Date(payload.startDate);
            if (payload.amount !== undefined) payload.amount = parseFloat(payload.amount);
            if (payload.dueDay !== undefined) payload.dueDay = parseInt(payload.dueDay, 10);
            if (payload.projectId) payload.projectId = new Types.ObjectId(payload.projectId);

            cleanOptionalFields(payload);

            const fixedExpense = await FixedExpenseService.update(req.params.id, payload as any);

            if (!fixedExpense) {
                res.status(404).json({ success: false, message: 'Fixed expense not found' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Fixed expense updated successfully',
                data: fixedExpense,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error updating fixed expense:');
            res.status(500).json({
                success: false,
                message: 'Failed to update fixed expense',
                error: error.message,
            });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            const deleted = await FixedExpenseService.delete(req.params.id, {
                deletedBy: userId,
                reason: 'Fixed expense delete requested from finance module',
            });

            if (!deleted) {
                res.status(404).json({ success: false, message: 'Fixed expense not found' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Fixed expense deleted successfully',
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error deleting fixed expense:');
            res.status(500).json({
                success: false,
                message: 'Failed to delete fixed expense',
                error: error.message,
            });
        }
    }

    static async getApprovals(req: Request, res: Response): Promise<void> {
        try {
            const status = (req.query.status as any) || 'all';
            const result = await FixedExpenseService.getApprovals({ status });

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching fixed expense approvals:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch fixed expense approvals',
                error: error.message,
            });
        }
    }

    static async getTransactions(req: Request, res: Response): Promise<void> {
        try {
            const transactions = await FixedExpenseService.getTransactions();

            res.status(200).json({
                success: true,
                data: transactions,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching fixed expense transactions:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch fixed expense transactions',
                error: error.message,
            });
        }
    }

    static async approve(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);

            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const payload: Record<string, any> = {
                ...req.body,
                paidDate: req.body.paidDate ? new Date(req.body.paidDate) : undefined,
                amount: req.body.amount !== undefined ? parseFloat(req.body.amount) : undefined,
            };
            cleanOptionalFields(payload);

            const approval = await FixedExpenseService.approve(
                req.params.id,
                payload,
                new Types.ObjectId(userId)
            );

            if (!approval) {
                res.status(404).json({ success: false, message: 'Approval request not found' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Fixed expense approved successfully',
                data: approval,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error approving fixed expense:');
            res.status(500).json({
                success: false,
                message: 'Failed to approve fixed expense',
                error: error.message,
            });
        }
    }

    static async reject(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);

            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const payload: Record<string, any> = {
                ...req.body,
                paidDate: req.body.paidDate ? new Date(req.body.paidDate) : undefined,
                amount: req.body.amount !== undefined ? parseFloat(req.body.amount) : undefined,
            };
            cleanOptionalFields(payload);

            const approval = await FixedExpenseService.reject(
                req.params.id,
                payload,
                new Types.ObjectId(userId)
            );

            if (!approval) {
                res.status(404).json({ success: false, message: 'Approval request not found' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Fixed expense rejected successfully',
                data: approval,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error rejecting fixed expense:');
            res.status(500).json({
                success: false,
                message: 'Failed to reject fixed expense',
                error: error.message,
            });
        }
    }
}
