import { Types } from 'mongoose';
import { Project, IProject, IProjectPhase } from '../models/Project.model';
import { Revenue, IRevenue } from '../../finance/models/Revenue.model';
import { IBankTransaction } from '../../finance/models/BankTransaction.model';
import { BankTransactionService } from '../../finance/services/bankTransaction.service';
import { ExchangeRateService } from '../../finance/services/exchangeRate.service';
import { IClient } from '../../client/models/Client.model';
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
        project: IProject;
        revenue: IRevenue;
        bankTransaction: IBankTransaction;
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

        // Only block if phase is FULLY paid (not on partial payments)
        const alreadyFullyPaid =
            phase.paymentStatus === 'received' ||
            (phase.paymentReceivedAmountINR !== undefined &&
                phase.paymentExpectedAmountINR !== undefined &&
                phase.paymentReceivedAmountINR >= phase.paymentExpectedAmountINR &&
                phase.paymentExpectedAmountINR > 0);

        if (alreadyFullyPaid) {
            throw new AppError('Payment for this phase is already fully received', 400);
        }

        // Block duplicate submissions: same phase + same amount + recorded within last 60 seconds
        const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
        const duplicateRevenue = await Revenue.findOne({
            projectId: project._id,
            phaseId: phaseObjectId,
            source: 'project',
            receivedAmount: this.roundMoney(receivedAmount),
            createdAt: { $gte: sixtySecondsAgo },
        }).select('_id');

        if (duplicateRevenue) {
            throw new AppError('This payment appears to be a duplicate. Please wait a moment before retrying.', 400);
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
        const actualReceivedINR = this.roundMoney(receivedAmount);

        const gstApplicable = phase.gstApplicable ?? true;
        const gstRate = phase.gstRate || 18;
        const tdsPercentage = phase.tdsPercentage || 0;

        /**
         * isGstInclusive flag controls how GST is applied:
         *   - true (or undefined for legacy): the received amount INCLUDES GST.
         *     We back-calculate base = total / (1 + rate)
         *   - false (exclusive): the received amount is the base. GST is added ON TOP.
         *     base = total; gst = total × rate
         *
         * IMPORTANT: undefined defaults to true for backward compatibility with
         * legacy records created before this field existed.
         */
        // Default undefined → true to protect historical inclusive contracts
        const isGstInclusive: boolean = phase.isGstInclusive !== false;
        let baseAmountINR: number;
        let gst: number;

        if (gstApplicable) {
            if (isGstInclusive) {
                // Amount received already INCLUDES GST → back-calculate
                baseAmountINR = this.roundMoney(actualReceivedINR / (1 + gstRate / 100));
                gst = this.roundMoney(actualReceivedINR - baseAmountINR);
            } else {
                // Amount is the base; GST is collected on top
                baseAmountINR = actualReceivedINR;
                gst = this.roundMoney(actualReceivedINR * (gstRate / 100));
            }
        } else {
            baseAmountINR = actualReceivedINR;
            gst = 0;
        }

        // TDS is deducted from base amount before payment; if TDS was already factored in
        // the received amount, we derive it from the base. Otherwise use phase setting.
        const tdsDeducted = tdsPercentage > 0
            ? this.roundMoney((baseAmountINR * tdsPercentage) / 100)
            : this.roundMoney(phase.tdsDeducted || 0);

        // The contracted full value of this phase (set when the phase was saved/created).
        // This is the baseline for determining whether a payment is partial or full.
        // Fall back to actualReceivedINR ONLY for legacy phases with no stored expected amount.
        const contractedTotalINR = (phase.paymentExpectedAmountINR && phase.paymentExpectedAmountINR > 0)
            ? this.roundMoney(phase.paymentExpectedAmountINR)
            : actualReceivedINR;
        const finalTotalAmountINR = contractedTotalINR;
        const finalBaseINR = baseAmountINR;
        const finalGst = gst;
        const finalTds = tdsDeducted;

        // Original currency amount, back-calculated from base INR
        const finalAmountOriginal = exchangeRate > 0
            ? this.roundMoney(finalBaseINR / exchangeRate)
            : finalBaseINR;

        // fxFees / tip tracking (delta between contracted value and actual receipt)
        const amountINR = conversion.amountINR; // contracted conversion value
        const contractedBase = gstApplicable
            ? this.roundMoney(amountINR / (1 + gstRate / 100))
            : amountINR;
        const contractedTotal = contractedBase + (gstApplicable ? this.roundMoney(amountINR - contractedBase) : 0);
        const delta = this.roundMoney(actualReceivedINR - contractedTotal);
        const fxFeesINR = delta < 0 && data.markAsFullyPaid ? Math.abs(delta) : 0;
        const tipINR = delta > 0 && !data.adjustPhaseValue ? delta : 0;

        // Get client info
        const client = project.clientId as unknown as IClient;
        const clientName = client?.name || 'Unknown Client';

        // Revenue status: fully paid when received == total (which it always is here),
        // or when the override flags are set.
        // Cumulative = what has already been received + what's being received now
        const cumulativeReceivedINR = this.roundMoney(
            (phase.paymentReceivedAmountINR || 0) + actualReceivedINR
        );
        const isFullyPaid = data.markAsFullyPaid || data.adjustPhaseValue ||
            cumulativeReceivedINR >= finalTotalAmountINR;
        const revenueStatus: 'received' | 'partial' = isFullyPaid ? 'received' : 'partial';

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
            amountINR: finalBaseINR,          // base amount (without GST)
            gstApplicable,
            gstRate,
            gst: finalGst,                    // GST component extracted from received amount
            tdsDeducted: finalTds,
            totalAmount: finalTotalAmountINR, // = actualReceivedINR (gross inclusive of GST)
            receivedAmount: actualReceivedINR,
            pendingAmount: 0,                 // always 0 — we record what was actually received
            fxFeesINR,
            tipINR,
            source: 'project',
            status: revenueStatus,
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
        const newPaymentStatus = isFullyPaid ? 'received' : 'partial';

        // $set fields that are safe to overwrite on each payment
        // NOTE: paymentExpectedAmountINR is NEVER overwritten here — it stays as
        // the contracted value set when the phase was created. Only the first
        // payment sets it if it was missing.
        const setFields: Record<string, unknown> = {
            'phases.$.paymentAmount': finalAmountOriginal,
            'phases.$.paymentReceivedAmount': updatedReceivedAmount,
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
        };

        // Only seed paymentExpectedAmountINR if it has never been set
        // (i.e., this is the very first payment for this phase)
        if (!phase.paymentExpectedAmountINR || phase.paymentExpectedAmountINR === 0) {
            setFields['phases.$.paymentExpectedAmountINR'] = finalTotalAmountINR;
        }

        await Project.updateOne(
            { _id: project._id, 'phases._id': phaseObjectId },
            {
                $set: setFields,
                // Accumulate received INR — never overwrite the total
                $inc: { 'phases.$.paymentReceivedAmountINR': actualReceivedINR },
            }
        );

        const updatedProject = (await Project.findById(project._id).lean()) as unknown as IProject;

        return {
            project: updatedProject,
            revenue: revenue as unknown as IRevenue,
            bankTransaction: bankTransaction as unknown as IBankTransaction,
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
    ): Promise<{ project: IProject; revenue: IRevenue; bankTransaction: IBankTransaction }> {
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
