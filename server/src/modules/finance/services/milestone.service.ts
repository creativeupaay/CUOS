import { PaymentMilestone, IPaymentMilestone } from '../models/PaymentMilestone.model';
import AppError from '../../../utils/appError';

/**
 * Create a payment milestone
 */
export const createMilestone = async (
    data: Partial<IPaymentMilestone>,
    userId: string
): Promise<IPaymentMilestone> => {
    const milestone = await PaymentMilestone.create({
        ...data,
        createdBy: userId,
    });
    return milestone;
};

/**
 * Get milestones for a project
 */
export const getProjectMilestones = async (projectId: string) => {
    const milestones = await PaymentMilestone.find({ projectId })
        .populate('invoiceId', 'invoiceNumber status')
        .sort({ dueDate: 1 });
    return milestones;
};

/**
 * Get milestone by ID
 */
export const getMilestoneById = async (id: string): Promise<IPaymentMilestone> => {
    const milestone = await PaymentMilestone.findById(id)
        .populate('invoiceId', 'invoiceNumber status');
    if (!milestone) throw new AppError('Milestone not found', 404);
    return milestone;
};

/**
 * Update a milestone
 */
export const updateMilestone = async (
    id: string,
    data: Partial<IPaymentMilestone>
): Promise<IPaymentMilestone> => {
    const milestone = await PaymentMilestone.findById(id);
    if (!milestone) throw new AppError('Milestone not found', 404);

    Object.assign(milestone, data);
    await milestone.save();
    return milestone;
};

/**
 * Mark milestone as completed (accrual event)
 */
export const completeMilestone = async (id: string): Promise<IPaymentMilestone> => {
    const milestone = await PaymentMilestone.findById(id);
    if (!milestone) throw new AppError('Milestone not found', 404);

    milestone.status = 'completed';
    milestone.completedAt = new Date();
    await milestone.save();
    return milestone;
};

/**
 * Mark milestone as paid (cash event)
 */
export const markMilestonePaid = async (id: string): Promise<IPaymentMilestone> => {
    const milestone = await PaymentMilestone.findById(id);
    if (!milestone) throw new AppError('Milestone not found', 404);

    milestone.status = 'paid';
    milestone.paidAt = new Date();
    await milestone.save();
    return milestone;
};

/**
 * Delete a milestone (only pending)
 */
export const deleteMilestone = async (id: string): Promise<void> => {
    const milestone = await PaymentMilestone.findById(id);
    if (!milestone) throw new AppError('Milestone not found', 404);
    if (milestone.status !== 'pending') {
        throw new AppError('Only pending milestones can be deleted', 400);
    }
    await PaymentMilestone.findByIdAndDelete(id);
};

/**
 * Get accrual vs cash revenue for milestones in a date range
 */
export const getAccrualVsCash = async (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Accrual: revenue recognized when milestone completed
    const accrualResult = await PaymentMilestone.aggregate([
        {
            $match: {
                completedAt: { $gte: start, $lte: end },
                status: { $in: ['completed', 'invoiced', 'paid'] },
            },
        },
        {
            $group: {
                _id: { $month: '$completedAt' },
                accrualRevenue: { $sum: '$amountInBaseCurrency' },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Cash: revenue recognized when payment received
    const cashResult = await PaymentMilestone.aggregate([
        {
            $match: {
                paidAt: { $gte: start, $lte: end },
                status: 'paid',
            },
        },
        {
            $group: {
                _id: { $month: '$paidAt' },
                cashRevenue: { $sum: '$amountInBaseCurrency' },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return { accrual: accrualResult, cash: cashResult };
};
