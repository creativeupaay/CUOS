import { Types } from 'mongoose';
import { Project, IProject, IProjectPhase } from '../models/Project.model';
import { Revenue } from '../../finance/models/Revenue.model';
import { BankTransactionService } from '../../finance/services/bankTransaction.service';
import { ExchangeRateService } from '../../finance/services/exchangeRate.service';
import AppError from '../../../utils/appError';

interface MarkPhasePaymentReceivedData {
    projectId: string;
    phaseId: string;
    receivedAmount: number;
    bankAccountKey: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
    receivedDate: Date;
    notes?: string;
    manualExchangeRate?: number;
    userId: string; // User marking the payment as received
    markAsFullyPaid?: boolean;
    adjustPhaseValue?: boolean;
}

export class PhasePaymentService {
    /**
     * Calculate the phase payment amount based on fixed amount or percentage
     */
    static calculatePhasePaymentAmount(
        phase: IProjectPhase,
        projectBudget?: number,
        projectCurrency?: string
    ): { amount: number; currency: string } {
        const currency = phase.paymentCurrency || projectCurrency || 'INR';

        // If phase has a fixed amount, use it
        if (phase.paymentAmount && phase.paymentAmount > 0) {
            return { amount: phase.paymentAmount, currency };
        }

        // If phase has a percentage and project has budget, calculate
        if (
            phase.paymentPercentage &&
            phase.paymentPercentage > 0 &&
            projectBudget &&
            projectBudget > 0
        ) {
            const amount = (projectBudget * phase.paymentPercentage) / 100;
            return { amount, currency };
        }

        return { amount: 0, currency };
    }

    private static roundMoney(value: number): number {
        return Math.round(Number(value || 0) * 100) / 100;
    }

    /**
     * Mark a phase payment as received
     * This will:
     * 1. Create a Revenue entry
     * 2. Create a BankTransaction entry (credit)
     * 3. Update the phase payment status
     * 4. Link the revenue and transaction back to the phase
     */
    static async markPhasePaymentReceived(
        data: MarkPhasePaymentReceivedData
    ): Promise<{
        project: any;
        revenue: any;
        bankTransaction: any;
    }> {
        const { projectId, phaseId, receivedAmount, bankAccountKey, receivedDate, notes, manualExchangeRate, userId } =
            data;

        // Find the project and phase
        const project = await Project.findById(projectId).populate('clientId', 'name email');

        if (!project) {
            throw new AppError('Project not found', 404);
        }

        const phase = project.phases.find((p: IProjectPhase) => p._id?.toString() === phaseId);

        if (!phase) {
            throw new AppError('Phase not found', 404);
        }

        if (!phase.hasPayment) {
            throw new AppError('This phase does not have payment tracking enabled', 400);
        }

        // Calculate expected payment amount
        const { amount: expectedAmount, currency } = this.calculatePhasePaymentAmount(
            phase,
            project.budget,
            project.currency
        );

        if (expectedAmount === 0) {
            throw new AppError(
                'Cannot receive payment for phase without payment amount or percentage',
                400
            );
        }

        const phaseObjectId = phase._id || new Types.ObjectId(phaseId);

        const alreadyRecorded =
            phase.paymentStatus === 'received' ||
            Boolean(phase.revenueId) ||
            Boolean(phase.bankTransactionId) ||
            (phase.paymentReceivedAmount || 0) >= expectedAmount;

        if (alreadyRecorded) {
            throw new AppError('Payment for this phase is already marked as received', 400);
        }

        const existingRevenue = await Revenue.findOne({
            projectId: project._id,
            phaseId: phaseObjectId,
            source: 'project',
            status: 'received',
        }).select('_id');

        if (existingRevenue) {
            throw new AppError('Payment for this phase has already been recorded', 400);
        }

        // Convert the contract/expected phase value into INR using the payment received date.
        // The dialog amount is the actual INR credited to the bank.
        const storedAmountINR = Number(phase.paymentExpectedAmountINR || 0);
        const storedExchangeRate = Number(phase.paymentExchangeRate || 0);
        let conversion: {
            rate: number;
            amountINR: number;
            date: Date;
            provider: string;
            source: string;
            requestedDate: Date;
            fallbackUsed: boolean;
        };

        if (storedAmountINR > 0 && storedExchangeRate > 0) {
            conversion = {
                rate: storedExchangeRate,
                amountINR: storedAmountINR,
                date: phase.paymentExchangeRateDate || phase.paymentFxRequestedDate || receivedDate,
                provider: phase.paymentFxRateSource === 'manual' ? 'manual' : 'stored',
                source: phase.paymentFxRateSource || 'exact-cache',
                requestedDate: phase.paymentFxRequestedDate || receivedDate,
                fallbackUsed: Boolean(phase.paymentFxFallbackUsed),
            };
        } else {
            try {
                conversion = await ExchangeRateService.convertToINR(expectedAmount, currency, receivedDate, {
                    manualRate: manualExchangeRate,
                    allowLatestFallback: true,
                });
            } catch (error: unknown) {
                throw new AppError(
                    'Manual exchange rate required before this phase payment can be marked as received',
                    409,
                    'FX_RATE_REQUIRED',
                    {
                        requirements: [{
                            phaseId,
                            phaseName: String(phase.name || 'Phase'),
                            currency,
                            date: receivedDate.toISOString().slice(0, 10),
                            amount: this.roundMoney(expectedAmount),
                        }],
                    }
                );
            }
        }
        const exchangeRate = conversion.rate;
        const amountINR = conversion.amountINR;
        const actualReceivedINR = this.roundMoney(receivedAmount);

        const gstApplicable = phase.gstApplicable ?? true;
        const isGstInclusive = phase.isGstInclusive ?? false;
        const gstRate = phase.gstRate || 18;
        const tdsPercentage = phase.tdsPercentage || 0;

        let baseAmountINR = amountINR;
        let gst = 0;

        if (gstApplicable) {
            if (isGstInclusive) {
                baseAmountINR = this.roundMoney(amountINR / (1 + gstRate / 100));
                gst = this.roundMoney(amountINR - baseAmountINR);
            } else {
                gst = this.roundMoney((amountINR * gstRate) / 100);
            }
        }

        // Calculate TDS based on base amount
        const tdsDeducted = tdsPercentage > 0 
            ? this.roundMoney((baseAmountINR * tdsPercentage) / 100)
            : this.roundMoney(phase.tdsDeducted || 0);

        const expectedTotalAmountINR = this.roundMoney(baseAmountINR + gst - tdsDeducted);

        // Handle discrepancies
        let fxFeesINR = 0;
        let tipINR = 0;
        let finalBaseINR = baseAmountINR;
        let finalGst = gst;
        let finalTds = tdsDeducted;
        let finalExpectedTotal = expectedTotalAmountINR;
        let finalAmountOriginal = expectedAmount;

        const delta = this.roundMoney(actualReceivedINR - expectedTotalAmountINR);

        if (delta < 0) {
            if (data.markAsFullyPaid) {
                fxFeesINR = Math.abs(delta);
            }
        } else if (delta > 0) {
            if (data.adjustPhaseValue) {
                // Adjust phase value so that actualReceivedINR is the new total
                const factor = 1 + (gstApplicable ? gstRate / 100 : 0) - (tdsPercentage / 100);
                finalBaseINR = this.roundMoney(actualReceivedINR / factor);
                finalGst = gstApplicable ? this.roundMoney((finalBaseINR * gstRate) / 100) : 0;
                finalTds = this.roundMoney((finalBaseINR * tdsPercentage) / 100);
                finalExpectedTotal = actualReceivedINR;
                
                // Also update the original currency amount
                finalAmountOriginal = this.roundMoney(finalBaseINR / exchangeRate);
            } else {
                tipINR = delta;
            }
        }

        // Get client info
        const client = project.clientId as any;
        const clientName = client?.name || 'Unknown Client';

        // Create Revenue entry
        const revenue = await Revenue.create({
            date: receivedDate,
            description: `Payment for ${project.name} - ${phase.name}`,
            client: clientName,
            clientId: client?._id,
            project: project.name,
            projectId: project._id,
            phaseId: phaseObjectId,
            amount: finalAmountOriginal,
            currency,
            exchangeRate,
            exchangeRateDate: conversion.date,
            exchangeRateProvider: conversion.provider,
            amountINR: finalBaseINR,
            gstApplicable,
            gstRate,
            gst: finalGst,
            tdsDeducted: finalTds,
            totalAmount: finalExpectedTotal,
            receivedAmount: actualReceivedINR,
            pendingAmount: data.markAsFullyPaid ? 0 : Math.max(0, this.roundMoney(finalExpectedTotal - actualReceivedINR)),
            fxFeesINR,
            tipINR,
            source: 'project',
            status: (actualReceivedINR + fxFeesINR) >= finalExpectedTotal ? 'received' : 'partial',
            notes: notes || `Auto-generated from project phase payment: ${phase.name}`,
            createdBy: new Types.ObjectId(userId),
        });

        // Create BankTransaction via service so managed account balances stay in sync.
        const bankTransaction = await BankTransactionService.create({
            accountKey: bankAccountKey,
            transactionType: 'credit',
            amount: actualReceivedINR,
            date: receivedDate,
            description: `Payment received: ${project.name} - ${phase.name}`,
            referenceNumber: `PHASE-${phaseId.slice(-8)}`,
            notes: notes || `Auto-generated from project phase payment`,
            source: 'automatic',
            projectId: project._id,
            phaseId: phaseObjectId,
            revenueId: revenue._id,
            createdBy: new Types.ObjectId(userId),
        });

        // Update phase with payment info
        const updatedReceivedAmount = this.roundMoney((phase.paymentReceivedAmount || 0) + actualReceivedINR);
        const isFullyPaid = (actualReceivedINR + fxFeesINR) >= finalExpectedTotal;
        const newPaymentStatus = isFullyPaid ? 'received' : 'partial';

        await Project.updateOne(
            { _id: project._id, 'phases._id': phaseObjectId },
            {
                $set: {
                    'phases.$.paymentAmount': finalAmountOriginal,
                    'phases.$.paymentReceivedAmount': updatedReceivedAmount,
                    'phases.$.paymentExpectedAmountINR': finalBaseINR,
                    'phases.$.paymentReceivedAmountINR': updatedReceivedAmount,
                    'phases.$.paymentExchangeRate': exchangeRate,
                    'phases.$.paymentExchangeRateDate': conversion.date,
                    'phases.$.paymentSettlementCurrency': 'INR',
                    'phases.$.paymentFxRateSource': conversion.source,
                    'phases.$.paymentFxRequestedDate': conversion.requestedDate,
                    'phases.$.paymentFxFallbackUsed': conversion.fallbackUsed,
                    'phases.$.paymentStatus': newPaymentStatus,
                    'phases.$.paymentBankAccount': bankAccountKey,
                    'phases.$.revenueId': revenue._id,
                    'phases.$.bankTransactionId': bankTransaction._id,
                    'phases.$.status': isFullyPaid ? 'completed' : phase.status,
                    'phases.$.completedAt': isFullyPaid ? new Date() : phase.completedAt,
                    'phases.$.tdsDeducted': finalTds,
                    'phases.$.fxFeesINR': fxFeesINR,
                    'phases.$.adjustmentAmountINR': tipINR,
                },
            }
        );

        const updatedProject = await Project.findById(project._id).lean();

        return {
            project: updatedProject,
            revenue: revenue.toObject(),
            bankTransaction: bankTransaction.toObject(),
        };
    }

    /**
     * Update phase payment as partial
     */
    static async markPhasePaymentPartial(
        projectId: string,
        phaseId: string,
        partialAmount: number,
        bankAccountKey: 'hdfc_gst' | 'sbi_non_gst' | 'cash',
        receivedDate: Date,
        notes: string | undefined,
        userId: string
    ): Promise<{ project: any; revenue: any; bankTransaction: any }> {
        // Same logic as markPhasePaymentReceived but updates status to 'partial'
        return this.markPhasePaymentReceived({
            projectId,
            phaseId,
            receivedAmount: partialAmount,
            bankAccountKey,
            receivedDate,
            notes,
            userId,
        });
    }

    /**
     * Get payment summary for a project
     */
    static async getProjectPaymentSummary(projectId: string): Promise<{
        totalExpectedPayment: number;
        totalReceivedPayment: number;
        totalPendingPayment: number;
        phasesWithPayment: number;
        phasesPaymentReceived: number;
        phaseDetails: Array<{
            phaseId: string;
            phaseName: string;
            expectedAmount: number;
            receivedAmount: number;
            pendingAmount: number;
            status: string;
            dueDate: Date | undefined;
        }>;
    }> {
        const project = await Project.findById(projectId);

        if (!project) {
            throw new AppError('Project not found', 404);
        }

        let totalExpectedPayment = 0;
        let totalReceivedPayment = 0;
        let phasesWithPayment = 0;
        let phasesPaymentReceived = 0;

        const phaseDetails = await Promise.all(project.phases
            .filter((phase: IProjectPhase) => phase.hasPayment)
            .map(async (phase: IProjectPhase) => {
                const { amount: expectedAmount, currency } = this.calculatePhasePaymentAmount(
                    phase,
                    project.budget,
                    project.currency
                );

                const conversionDate = phase.paymentDueDate || phase.endDate || new Date();
                const conversion = await ExchangeRateService.convertToINR(expectedAmount, currency, conversionDate);
                const expectedAmountINR = phase.paymentExpectedAmountINR ?? conversion.amountINR;
                const receivedAmount = phase.paymentReceivedAmountINR ?? phase.paymentReceivedAmount ?? 0;
                const pendingAmount = Math.max(0, expectedAmountINR - receivedAmount);

                totalExpectedPayment += expectedAmountINR;
                totalReceivedPayment += receivedAmount;
                phasesWithPayment += 1;

                if (phase.paymentStatus === 'received') {
                    phasesPaymentReceived += 1;
                }

                return {
                    phaseId: phase._id?.toString() || '',
                    phaseName: phase.name,
                    expectedAmount: expectedAmountINR,
                    receivedAmount,
                    pendingAmount,
                    status: phase.paymentStatus || 'pending',
                    dueDate: phase.paymentDueDate,
                };
            }));

        return {
            totalExpectedPayment,
            totalReceivedPayment,
            totalPendingPayment: totalExpectedPayment - totalReceivedPayment,
            phasesWithPayment,
            phasesPaymentReceived,
            phaseDetails,
        };
    }
}
