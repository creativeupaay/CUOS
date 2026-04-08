import { Revenue, IRevenue } from '../models/Revenue.model';
import { Types, FilterQuery } from 'mongoose';

interface CreateRevenueData {
    date: Date;
    description: string;
    client: string;
    clientId?: Types.ObjectId;
    project?: string;
    projectId?: Types.ObjectId;
    amount: number;
    currency?: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
    exchangeRate?: number;
    gstApplicable?: boolean;
    gstRate?: number;
    tdsDeducted?: number;
    receivedAmount?: number;
    source?: 'manual' | 'invoice' | 'project';
    status?: 'received' | 'pending' | 'partial' | 'overdue';
    invoiceNumber?: string;
    dueDate?: Date;
    notes?: string;
    createdBy: Types.ObjectId;
}

interface RevenueFilters {
    status?: string;
    source?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    clientId?: Types.ObjectId;
    projectId?: Types.ObjectId;
    page?: number;
    limit?: number;
}

export class RevenueService {
    /**
     * Create a new revenue entry
     */
    static async create(data: CreateRevenueData): Promise<IRevenue> {
        const currency = data.currency || 'INR';
        const exchangeRate = data.exchangeRate || 1;
        const amountINR = currency === 'INR' ? data.amount : data.amount * exchangeRate;

        const gstApplicable = data.gstApplicable ?? true;
        const gstRate = data.gstRate || 18;
        const gst = gstApplicable ? (amountINR * gstRate) / 100 : 0;
        const tdsDeducted = data.tdsDeducted || 0;
        const totalAmount = amountINR + gst - tdsDeducted;

        const revenue = new Revenue({
            ...data,
            currency,
            exchangeRate,
            amountINR,
            gstApplicable,
            gstRate,
            gst,
            totalAmount,
            receivedAmount: data.receivedAmount || 0,
            pendingAmount: totalAmount - (data.receivedAmount || 0),
        });

        return revenue.save();
    }

    /**
     * Get all revenues with filters
     */
    static async getAll(filters: RevenueFilters): Promise<{ revenues: IRevenue[]; total: number }> {
        const query: FilterQuery<IRevenue> = {};

        if (filters.status) {
            query.status = filters.status;
        }

        if (filters.source) {
            query.source = filters.source;
        }

        if (filters.clientId) {
            query.clientId = filters.clientId;
        }

        if (filters.projectId) {
            query.projectId = filters.projectId;
        }

        if (filters.startDate || filters.endDate) {
            query.date = {};
            if (filters.startDate) query.date.$gte = filters.startDate;
            if (filters.endDate) query.date.$lte = filters.endDate;
        }

        if (filters.search) {
            const searchRegex = new RegExp(filters.search, 'i');
            query.$or = [
                { description: searchRegex },
                { client: searchRegex },
                { invoiceNumber: searchRegex },
                { project: searchRegex },
            ];
        }

        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const skip = (page - 1) * limit;

        const [revenues, total] = await Promise.all([
            Revenue.find(query)
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Revenue.countDocuments(query),
        ]);

        return { revenues: revenues as IRevenue[], total };
    }

    /**
     * Get revenue by ID
     */
    static async getById(id: Types.ObjectId | string): Promise<IRevenue | null> {
        return Revenue.findById(id).lean();
    }

    /**
     * Update revenue
     */
    static async update(
        id: Types.ObjectId | string,
        data: Partial<CreateRevenueData> & { updatedBy: Types.ObjectId }
    ): Promise<IRevenue | null> {
        // Recalculate amounts if needed
        const existing = await Revenue.findById(id);
        if (!existing) return null;

        const currency = data.currency || existing.currency;
        const exchangeRate = data.exchangeRate ?? existing.exchangeRate;
        const amount = data.amount ?? existing.amount;
        const amountINR = currency === 'INR' ? amount : amount * exchangeRate;

        const gstApplicable = data.gstApplicable ?? existing.gstApplicable;
        const gstRate = data.gstRate ?? existing.gstRate;
        const gst = gstApplicable ? (amountINR * gstRate) / 100 : 0;
        const tdsDeducted = data.tdsDeducted ?? existing.tdsDeducted;
        const totalAmount = amountINR + gst - tdsDeducted;

        return Revenue.findByIdAndUpdate(
            id,
            {
                ...data,
                currency,
                exchangeRate,
                amountINR,
                gstApplicable,
                gstRate,
                gst,
                totalAmount,
            },
            { new: true }
        ).lean();
    }

    /**
     * Delete revenue
     */
    static async delete(id: Types.ObjectId | string): Promise<boolean> {
        const result = await Revenue.findByIdAndDelete(id);
        return !!result;
    }

    /**
     * Get revenue summary for date range
     */
    static async getSummary(startDate: Date, endDate: Date): Promise<{
        totalRevenue: number;
        totalReceived: number;
        totalPending: number;
        totalGST: number;
        byStatus: Record<string, number>;
        bySource: Record<string, number>;
    }> {
        const revenues = await Revenue.find({
            date: { $gte: startDate, $lte: endDate },
        }).lean();

        const summary = {
            totalRevenue: 0,
            totalReceived: 0,
            totalPending: 0,
            totalGST: 0,
            byStatus: {} as Record<string, number>,
            bySource: {} as Record<string, number>,
        };

        for (const rev of revenues) {
            summary.totalRevenue += rev.amountINR;
            summary.totalReceived += rev.receivedAmount;
            summary.totalPending += rev.pendingAmount;
            summary.totalGST += rev.gst;

            summary.byStatus[rev.status] = (summary.byStatus[rev.status] || 0) + rev.amountINR;
            summary.bySource[rev.source] = (summary.bySource[rev.source] || 0) + rev.amountINR;
        }

        return summary;
    }

    /**
     * Get monthly revenue data for charts
     */
    static async getMonthlyData(startDate: Date, endDate: Date): Promise<{
        month: string;
        revenue: number;
        received: number;
        pending: number;
    }[]> {
        const result = await Revenue.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                    },
                    revenue: { $sum: '$amountINR' },
                    received: { $sum: '$receivedAmount' },
                    pending: { $sum: '$pendingAmount' },
                },
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 },
            },
        ]);

        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        return result.map((r) => ({
            month: `${monthNames[r._id.month]} ${r._id.year}`,
            revenue: r.revenue,
            received: r.received,
            pending: r.pending,
        }));
    }
}
