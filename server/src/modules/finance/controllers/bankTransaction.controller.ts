import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { BankTransactionService } from '../services/bankTransaction.service';
import { BankAccountKey, BankTransactionType } from '../models/BankTransaction.model';
import { logger } from "../../../utils/logger";

const getAuthenticatedUserId = (req: Request) => (req as any).user?.id ?? (req as any).user?._id;

export class BankTransactionController {
    static async getManagedAccounts(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const accounts = await BankTransactionService.getManagedAccountDetails(new Types.ObjectId(userId));
            res.status(200).json({ success: true, data: accounts });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching managed bank accounts:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch managed bank accounts',
                error: error.message,
            });
        }
    }

    static async updateManagedAccount(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const account = await BankTransactionService.updateManagedAccountDetails(req.params.accountKey as BankAccountKey, {
                accountName: req.body.accountName,
                bankName: req.body.bankName,
                accountNumber: req.body.accountNumber,
                ifscCode: req.body.ifscCode,
                swiftCode: req.body.swiftCode,
                notes: req.body.notes,
                isPrimary: req.body.isPrimary,
                isActive: req.body.isActive,
                updatedBy: new Types.ObjectId(userId),
            });

            if (!account) {
                res.status(404).json({ success: false, message: 'Bank account not found' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Bank account updated successfully',
                data: account,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error updating managed bank account:');
            res.status(500).json({
                success: false,
                message: 'Failed to update bank account',
                error: error.message,
            });
        }
    }

    static async getOtherAccounts(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const accounts = await BankTransactionService.getOtherAccountDetails(new Types.ObjectId(userId));
            res.status(200).json({ success: true, data: accounts });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching other bank accounts:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch other bank accounts',
                error: error.message,
            });
        }
    }

    static async createOtherAccount(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const account = await BankTransactionService.createOtherAccount({
                accountName: req.body.accountName,
                bankName: req.body.bankName,
                accountNumber: req.body.accountNumber,
                ifscCode: req.body.ifscCode,
                swiftCode: req.body.swiftCode,
                notes: req.body.notes,
                accountType: req.body.accountType,
                currency: req.body.currency,
                currentBalance: req.body.currentBalance !== undefined ? Number(req.body.currentBalance) : undefined,
                isPrimary: req.body.isPrimary,
                isActive: req.body.isActive,
                createdBy: new Types.ObjectId(userId),
            });

            res.status(201).json({
                success: true,
                message: 'Other bank account created successfully',
                data: account,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error creating other bank account:');
            res.status(500).json({
                success: false,
                message: 'Failed to create other bank account',
                error: error.message,
            });
        }
    }

    static async updateOtherAccount(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const account = await BankTransactionService.updateOtherAccount(req.params.id, {
                accountName: req.body.accountName,
                bankName: req.body.bankName,
                accountNumber: req.body.accountNumber,
                ifscCode: req.body.ifscCode,
                swiftCode: req.body.swiftCode,
                notes: req.body.notes,
                accountType: req.body.accountType,
                currency: req.body.currency,
                currentBalance: req.body.currentBalance !== undefined ? Number(req.body.currentBalance) : undefined,
                isPrimary: req.body.isPrimary,
                isActive: req.body.isActive,
                updatedBy: new Types.ObjectId(userId),
            });

            if (!account) {
                res.status(404).json({ success: false, message: 'Bank account not found' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Other bank account updated successfully',
                data: account,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error updating other bank account:');
            res.status(500).json({
                success: false,
                message: 'Failed to update other bank account',
                error: error.message,
            });
        }
    }

    static async deleteOtherAccount(req: Request, res: Response): Promise<void> {
        try {
            const deleted = await BankTransactionService.deleteOtherAccount(req.params.id);
            if (!deleted) {
                res.status(404).json({ success: false, message: 'Bank account not found' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Other bank account deleted successfully',
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error deleting other bank account:');
            res.status(500).json({
                success: false,
                message: 'Failed to delete other bank account',
                error: error.message,
            });
        }
    }

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const transaction = await BankTransactionService.create({
                accountKey: req.body.accountKey as BankAccountKey,
                transactionType: req.body.transactionType as BankTransactionType,
                amount: parseFloat(req.body.amount),
                date: new Date(req.body.date),
                description: req.body.description,
                referenceNumber: req.body.referenceNumber || undefined,
                notes: req.body.notes || undefined,
                source: req.body.source || 'manual',
                createdBy: new Types.ObjectId(userId),
            });

            res.status(201).json({
                success: true,
                message: 'Bank transaction created successfully',
                data: transaction,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error creating bank transaction:');
            res.status(500).json({
                success: false,
                message: 'Failed to create bank transaction',
                error: error.message,
            });
        }
    }

    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const result = await BankTransactionService.getAll({
                accountKey: req.query.accountKey as BankAccountKey | undefined,
                transactionType: req.query.transactionType as BankTransactionType | undefined,
                search: req.query.search as string | undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
                limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
            }, new Types.ObjectId(userId));

            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching bank transactions:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch bank transactions',
                error: error.message,
            });
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const transaction = await BankTransactionService.getById(req.params.id);
            if (!transaction) {
                res.status(404).json({ success: false, message: 'Bank transaction not found' });
                return;
            }

            res.status(200).json({ success: true, data: transaction });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching bank transaction:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch bank transaction',
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

            const transaction = await BankTransactionService.update(req.params.id, {
                accountKey: req.body.accountKey as BankAccountKey | undefined,
                transactionType: req.body.transactionType as BankTransactionType | undefined,
                amount: req.body.amount !== undefined ? parseFloat(req.body.amount) : undefined,
                date: req.body.date ? new Date(req.body.date) : undefined,
                description: req.body.description,
                referenceNumber: req.body.referenceNumber,
                notes: req.body.notes,
                source: req.body.source,
                updatedBy: new Types.ObjectId(userId),
            });

            if (!transaction) {
                res.status(404).json({ success: false, message: 'Bank transaction not found' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Bank transaction updated successfully',
                data: transaction,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error updating bank transaction:');
            res.status(500).json({
                success: false,
                message: 'Failed to update bank transaction',
                error: error.message,
            });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const deleted = await BankTransactionService.delete(req.params.id);
            if (!deleted) {
                res.status(404).json({ success: false, message: 'Bank transaction not found' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Bank transaction deleted successfully',
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error deleting bank transaction:');
            res.status(500).json({
                success: false,
                message: 'Failed to delete bank transaction',
                error: error.message,
            });
        }
    }
}
