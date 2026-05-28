import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { PhasePaymentService } from '../services/phasePayment.service';
import AppError from '../../../utils/appError';

/**
 * Mark phase payment as received
 * POST /api/projects/:projectId/phases/:phaseId/mark-payment-received
 */
export const markPhasePaymentReceived = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id: projectId, phaseId } = req.params;
        const { receivedAmount, bankAccountKey, receivedDate, notes, manualExchangeRate, markAsFullyPaid, adjustPhaseValue } = req.body;
        const userId = req.user?.id?.toString() || req.user?._id?.toString();

        if (!userId) {
            return next(new AppError('Not authenticated', 401));
        }

        if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(phaseId)) {
            return next(new AppError('Invalid project or phase ID', 400));
        }

        if (!receivedAmount || receivedAmount <= 0) {
            return next(new AppError('Received amount must be greater than 0', 400));
        }

        if (!bankAccountKey || !['hdfc_gst', 'sbi_non_gst', 'cash'].includes(bankAccountKey)) {
            return next(
                new AppError('Bank account key must be hdfc_gst, sbi_non_gst, or cash', 400)
            );
        }

        const result = await PhasePaymentService.markPhasePaymentReceived({
            projectId,
            phaseId,
            receivedAmount: Number(receivedAmount),
            bankAccountKey,
            receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
            notes,
            manualExchangeRate: manualExchangeRate ? Number(manualExchangeRate) : undefined,
            markAsFullyPaid: markAsFullyPaid === true,
            adjustPhaseValue: adjustPhaseValue === true,
            userId,
        });

        res.status(200).json({
            status: 'success',
            data: {
                project: result.project,
                revenue: result.revenue,
                bankTransaction: result.bankTransaction,
            },
            message: 'Phase payment marked as received successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get project payment summary
 * GET /api/projects/:projectId/payment-summary
 */
export const getProjectPaymentSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id: projectId } = req.params;

        const summary = await PhasePaymentService.getProjectPaymentSummary(projectId);

        res.status(200).json({
            status: 'success',
            data: summary,
        });
    } catch (error) {
        next(error);
    }
};
