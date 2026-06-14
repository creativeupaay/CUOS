import { Request, Response } from 'express';
import { RevenueService } from '../services/revenue.service';
import { Types } from 'mongoose';
import { logger } from "../../../utils/logger";
import { ExchangeRateService } from '../services/exchangeRate.service';
import { Project } from '../../project/models/Project.model';

const roundMoney = (value: number) => Math.round(Number(value || 0) * 100) / 100;

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
                gstRate: parseFloat(req.body.gstRate || 0),
                tdsDeducted: parseFloat(req.body.tdsDeducted || 0),
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
            logger.error({ context: error }, 'Error creating revenue:');
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
                startDate: req.query.startDate ? new Date(`${req.query.startDate}T00:00:00.000+05:30`) : undefined,
                endDate: req.query.endDate ? new Date(`${req.query.endDate}T23:59:59.999+05:30`) : undefined,
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
            logger.error({ context: error }, 'Error fetching revenues:');
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
            logger.error({ context: error }, 'Error fetching revenue:');
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
            if (revenueData.gstRate !== undefined) revenueData.gstRate = parseFloat(revenueData.gstRate);
            if (revenueData.tdsDeducted !== undefined) revenueData.tdsDeducted = parseFloat(revenueData.tdsDeducted);
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
            logger.error({ context: error }, 'Error updating revenue:');
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
            const userId = getAuthenticatedUserId(req);
            const deleted = await RevenueService.delete(req.params.id, {
                deletedBy: userId,
                reason: 'Revenue delete requested from finance module',
            });

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
            logger.error({ context: error }, 'Error deleting revenue:');
            res.status(500).json({
                success: false,
                message: 'Failed to delete revenue',
                error: error.message,
            });
        }
    }

    static async getReceivables(_req: Request, res: Response): Promise<void> {
        try {
            const result = await RevenueService.getReceivables();

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching receivables:');
            res.status(error.statusCode || 500).json({
                success: false,
                message: 'Failed to fetch receivables',
                error: error.message,
            });
        }
    }

    /**
     * Get exchange rate for a currency and date
     */
    static async getExchangeRate(req: Request, res: Response): Promise<void> {
        try {
            const { currency, date } = req.query;
            
            if (!currency) {
                res.status(400).json({
                    success: false,
                    message: 'Currency is required',
                });
                return;
            }

            const requestedDate = date ? new Date(date as string) : new Date();
            
            const result = await ExchangeRateService.getRateToINR(
                currency as string,
                requestedDate,
                { allowLatestFallback: true }
            );

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching exchange rate:');
            res.status(error.statusCode || 500).json({
                success: false,
                message: 'Failed to fetch exchange rate',
                error: error.message,
            });
        }
    }

    /**
     * Resolve FX rates for phase-payment receivables that have FX_RATE_REQUIRED warnings.
     * POST /finance/receivables/resolve-fx
     * Body: { resolutions: [{ projectId, phaseId, rate }] }
     */
    static async resolveReceivableFxRates(req: Request, res: Response): Promise<void> {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const { resolutions } = req.body as {
                resolutions: Array<{ projectId: string; phaseId: string; rate: number }>;
            };

            if (!Array.isArray(resolutions) || resolutions.length === 0) {
                res.status(400).json({ success: false, message: 'resolutions array is required and must not be empty' });
                return;
            }

            const results: Array<{ projectId: string; phaseId: string; success: boolean; error?: string }> = [];

            for (const item of resolutions) {
                const { projectId, phaseId, rate } = item;

                if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(phaseId)) {
                    results.push({ projectId, phaseId, success: false, error: 'Invalid projectId or phaseId' });
                    continue;
                }

                const numericRate = Number(rate);
                if (!Number.isFinite(numericRate) || numericRate <= 0) {
                    results.push({ projectId, phaseId, success: false, error: 'Rate must be a positive number' });
                    continue;
                }

                try {
                    // Load project and find the phase
                    const project = await Project.findOne({
                        _id: new Types.ObjectId(projectId),
                        isArchived: false,
                        'phases._id': new Types.ObjectId(phaseId),
                    }).lean();

                    if (!project) {
                        results.push({ projectId, phaseId, success: false, error: 'Project or phase not found' });
                        continue;
                    }

                    const phase = (project.phases as any[]).find(
                        (p: any) => String(p._id) === phaseId
                    );

                    if (!phase) {
                        results.push({ projectId, phaseId, success: false, error: 'Phase not found' });
                        continue;
                    }

                    // Determine the original amount and currency
                    const currency = phase.paymentCurrency || (project as any).currency || 'INR';
                    const originalAmount = Number(
                        phase.paymentAmount
                        || (phase.paymentPercentage > 0 ? ((project as any).budget || 0) * phase.paymentPercentage / 100 : 0)
                        || 0
                    );

                    if (originalAmount <= 0) {
                        results.push({ projectId, phaseId, success: false, error: 'Phase has no payment amount configured' });
                        continue;
                    }

                    const expectedINR = roundMoney(originalAmount * numericRate);
                    const today = new Date().toISOString().slice(0, 10);

                    await Project.updateOne(
                        {
                            _id: new Types.ObjectId(projectId),
                            'phases._id': new Types.ObjectId(phaseId),
                        },
                        {
                            $set: {
                                'phases.$.paymentExchangeRate': numericRate,
                                'phases.$.paymentExchangeRateDate': today,
                                'phases.$.paymentFxRateSource': 'manual',
                                'phases.$.paymentFxFallbackUsed': false,
                                'phases.$.paymentExpectedAmountINR': expectedINR,
                                'phases.$.paymentSettlementCurrency': 'INR',
                                'phases.$.updatedAt': new Date(),
                            },
                        }
                    );

                    results.push({ projectId, phaseId, success: true });
                } catch (innerError: any) {
                    logger.error({ context: innerError }, `Error resolving FX for phase ${phaseId}:`);
                    results.push({ projectId, phaseId, success: false, error: innerError.message });
                }
            }

            const failed = results.filter((r) => !r.success);
            if (failed.length === resolutions.length) {
                res.status(400).json({ success: false, message: 'All resolutions failed', data: results });
                return;
            }

            res.status(200).json({
                success: true,
                message: failed.length > 0 ? 'Some resolutions failed' : 'FX rates resolved successfully',
                data: results,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error resolving receivable FX rates:');
            res.status(500).json({
                success: false,
                message: 'Failed to resolve FX rates',
                error: error.message,
            });
        }
    }
}
