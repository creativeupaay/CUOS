import { Request, Response } from 'express';
import { RevenueService } from '../services/revenue.service';
import { Types } from 'mongoose';

const getAuthenticatedUserId = (req: Request) => (req as any).user?.id ?? (req as any).user?._id;

export class RevenueController {
    /**
     * Create a new revenue entry
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
            const revenueData = {
                ...req.body,
                createdBy: new Types.ObjectId(userId),
                date: new Date(req.body.date), // Convert string to Date
                amount: parseFloat(req.body.amount), // Ensure amount is a number
                exchangeRate: parseFloat(req.body.exchangeRate || 1), // Default to 1 for INR
                amountINR: parseFloat(req.body.amountINR || req.body.amount), // Calculate or use provided
                gstRate: parseFloat(req.body.gstRate || 0),
                gst: parseFloat(req.body.gst || 0),
                tdsDeducted: parseFloat(req.body.tdsDeducted || 0),
                totalAmount: parseFloat(req.body.totalAmount || req.body.amount),
                receivedAmount: parseFloat(req.body.receivedAmount || 0),
            };

            // Convert dueDate if provided
            if (revenueData.dueDate) {
                revenueData.dueDate = new Date(revenueData.dueDate);
            }

            // Remove empty string fields that should be undefined
            if (revenueData.project === '') delete revenueData.project;
            if (revenueData.projectId === '') delete revenueData.projectId;
            if (revenueData.clientId === '') delete revenueData.clientId;
            if (revenueData.invoiceNumber === '') delete revenueData.invoiceNumber;
            if (revenueData.invoiceId === '') delete revenueData.invoiceId;
            if (revenueData.notes === '') delete revenueData.notes;

            // Set default values for boolean fields
            if (revenueData.gstApplicable === undefined) revenueData.gstApplicable = false;

            // Set default source if not provided
            if (!revenueData.source) revenueData.source = 'manual';

            const revenue = await RevenueService.create(revenueData);

            res.status(201).json({
                success: true,
                message: 'Revenue entry created successfully',
                data: revenue,
            });
        } catch (error: any) {
            console.error('Error creating revenue:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create revenue entry',
                error: error.message,
            });
        }
    }

    /**
     * Get all revenues with filters
     */
    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const filters = {
                status: req.query.status as string,
                source: req.query.source as string,
                search: req.query.search as string,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                clientId: req.query.clientId ? new Types.ObjectId(req.query.clientId as string) : undefined,
                projectId: req.query.projectId ? new Types.ObjectId(req.query.projectId as string) : undefined,
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
            };

            const result = await RevenueService.getAll(filters);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            console.error('Error fetching revenues:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch revenues',
                error: error.message,
            });
        }
    }

    /**
     * Get revenue by ID
     */
    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const revenue = await RevenueService.getById(req.params.id);

            if (!revenue) {
                res.status(404).json({
                    success: false,
                    message: 'Revenue entry not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: revenue,
            });
        } catch (error: any) {
            console.error('Error fetching revenue:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch revenue',
                error: error.message,
            });
        }
    }

    /**
     * Update revenue
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
            const revenueData = {
                ...req.body,
                updatedBy: new Types.ObjectId(userId),
            };

            // Convert date if provided
            if (revenueData.date) {
                revenueData.date = new Date(revenueData.date);
            }

            // Convert dueDate if provided
            if (revenueData.dueDate) {
                revenueData.dueDate = new Date(revenueData.dueDate);
            }

            // Ensure numeric fields are proper numbers if provided
            if (revenueData.amount !== undefined) revenueData.amount = parseFloat(revenueData.amount);
            if (revenueData.exchangeRate !== undefined) revenueData.exchangeRate = parseFloat(revenueData.exchangeRate);
            if (revenueData.amountINR !== undefined) revenueData.amountINR = parseFloat(revenueData.amountINR);
            if (revenueData.gstRate !== undefined) revenueData.gstRate = parseFloat(revenueData.gstRate);
            if (revenueData.gst !== undefined) revenueData.gst = parseFloat(revenueData.gst);
            if (revenueData.tdsDeducted !== undefined) revenueData.tdsDeducted = parseFloat(revenueData.tdsDeducted);
            if (revenueData.totalAmount !== undefined) revenueData.totalAmount = parseFloat(revenueData.totalAmount);
            if (revenueData.receivedAmount !== undefined) revenueData.receivedAmount = parseFloat(revenueData.receivedAmount);

            // Remove empty string fields that should be undefined
            if (revenueData.project === '') delete revenueData.project;
            if (revenueData.projectId === '') delete revenueData.projectId;
            if (revenueData.clientId === '') delete revenueData.clientId;
            if (revenueData.invoiceNumber === '') delete revenueData.invoiceNumber;
            if (revenueData.invoiceId === '') delete revenueData.invoiceId;
            if (revenueData.notes === '') delete revenueData.notes;

            const revenue = await RevenueService.update(req.params.id, revenueData);

            if (!revenue) {
                res.status(404).json({
                    success: false,
                    message: 'Revenue entry not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Revenue entry updated successfully',
                data: revenue,
            });
        } catch (error: any) {
            console.error('Error updating revenue:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update revenue',
                error: error.message,
            });
        }
    }

    /**
     * Delete revenue
     */
    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const deleted = await RevenueService.delete(req.params.id);

            if (!deleted) {
                res.status(404).json({
                    success: false,
                    message: 'Revenue entry not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Revenue entry deleted successfully',
            });
        } catch (error: any) {
            console.error('Error deleting revenue:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete revenue',
                error: error.message,
            });
        }
    }
}
