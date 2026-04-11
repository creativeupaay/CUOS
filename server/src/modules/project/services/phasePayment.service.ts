import { Types } from 'mongoose';
import { Project } from '../models/Project.model';
import { Revenue } from '../../finance/models/Revenue.model';
import { BankTransactionService } from '../../finance/services/bankTransaction.service';
import AppError from '../../../utils/appError';

interface MarkPhasePaymentReceivedData {
    projectId: string;
    phaseId: string;
    receivedAmount: number;
    bankAccountKey: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
    receivedDate: Date;
    notes?: string;
    userId: string; // User marking the payment as received
}

export class PhasePaymentService {
    /**
     * Calculate the phase payment amount based on fixed amount or percentage
     */
    static calculatePhasePaymentAmount(
        phase: any,
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
        const { projectId, phaseId, receivedAmount, bankAccountKey, receivedDate, notes, userId } =
            data;

        // Find the project and phase
        const project = await Project.findById(projectId).populate('clientId', 'name email');

        if (!project) {
            throw new AppError('Project not found', 404);
        }

        const phase = project.phases.find((p: any) => p._id?.toString() === phaseId);

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

        // Calculate amounts in INR (for consistent revenue tracking)
        const exchangeRate = currency === 'INR' ? 1 : 1; // TODO: Add exchange rate lookup
        const amountINR = currency === 'INR' ? receivedAmount : receivedAmount * exchangeRate;

        // Payment should reflect the exact amount received from user input.
        const gstApplicable = phase.gstApplicable ?? true;
        const gstRate = phase.gstRate || 18;
        const gst = 0;
        const tdsDeducted = 0;
        const totalAmount = receivedAmount;

        // Get client info
        const client: any = project.clientId;
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
            amount: receivedAmount,
            currency,
            exchangeRate,
            amountINR,
            gstApplicable,
            gstRate,
            gst,
            tdsDeducted,
            totalAmount,
            receivedAmount: totalAmount,
            pendingAmount: 0,
            source: 'project',
            status: 'received',
            notes: notes || `Auto-generated from project phase payment: ${phase.name}`,
            createdBy: new Types.ObjectId(userId),
        });

        // Create BankTransaction via service so managed account balances stay in sync.
        const bankTransaction = await BankTransactionService.create({
            accountKey: bankAccountKey,
            transactionType: 'credit',
            amount: totalAmount,
            date: receivedDate,
            description: `Payment received: ${project.name} - ${phase.name}`,
            referenceNumber: `PHASE-${phaseId.slice(-8)}`,
            notes: notes || `Auto-generated from project phase payment`,
            source: 'automatic',
            createdBy: new Types.ObjectId(userId),
        });

        // Update phase with payment info
        const updatedReceivedAmount = (phase.paymentReceivedAmount || 0) + totalAmount;
        const newPaymentStatus =
            updatedReceivedAmount >= expectedAmount ? 'received' : 'partial';

        await Project.updateOne(
            { _id: project._id, 'phases._id': phaseObjectId },
            {
                $set: {
                    'phases.$.paymentReceivedAmount': updatedReceivedAmount,
                    'phases.$.paymentStatus': newPaymentStatus,
                    'phases.$.paymentBankAccount': bankAccountKey,
                    'phases.$.revenueId': revenue._id,
                    'phases.$.bankTransactionId': bankTransaction._id,
                    'phases.$.status': 'completed',
                    'phases.$.completedAt': new Date(),
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
    ): Promise<any> {
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

        const phaseDetails = project.phases
            .filter((phase: any) => phase.hasPayment)
            .map((phase: any) => {
                const { amount: expectedAmount } = this.calculatePhasePaymentAmount(
                    phase,
                    project.budget,
                    project.currency
                );

                const receivedAmount = phase.paymentReceivedAmount || 0;
                const pendingAmount = expectedAmount - receivedAmount;

                totalExpectedPayment += expectedAmount;
                totalReceivedPayment += receivedAmount;
                phasesWithPayment += 1;

                if (phase.paymentStatus === 'received') {
                    phasesPaymentReceived += 1;
                }

                return {
                    phaseId: phase._id?.toString() || '',
                    phaseName: phase.name,
                    expectedAmount,
                    receivedAmount,
                    pendingAmount,
                    status: phase.paymentStatus || 'pending',
                    dueDate: phase.paymentDueDate,
                };
            });

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
