import { Types } from 'mongoose';
import { Revenue, IRevenue, RevenueSource, RevenueStatus } from '../models/Revenue.model';
import { Invoice } from '../models/Invoice.model';
import AppError from '../../../utils/appError';

// ── Types ───────────────────────────────────────────────────────────
interface CreateRevenuePayload {
    title: string;
    description?: string;
    source: RevenueSource;
    amount: number;
    currency?: string;
    exchangeRate?: number;
    gstApplicable?: boolean;
    gstRate?: number;
    tdsApplicable?: boolean;
    tdsRate?: number;
    projectId?: string;
    clientId?: string;
    accrualMonth: number;
    accrualYear: number;
    notes?: string;
}

interface RevenueFilters {
    page?: number;
    limit?: number;
    source?: RevenueSource;
    status?: RevenueStatus;
    projectId?: string;
    clientId?: string;
    startDate?: string;
    endDate?: string;
    year?: number;
}

// ── Create Revenue ──────────────────────────────────────────────────
export const createRevenue = async (
    data: CreateRevenuePayload,
    userId: string
): Promise<IRevenue> => {
    const revenue = new Revenue({
        ...data,
        currency: data.currency || 'INR',
        exchangeRate: data.exchangeRate || 1,
        gstApplicable: data.gstApplicable ?? true,
        gstRate: data.gstRate ?? 18,
        tdsApplicable: data.tdsApplicable ?? false,
        tdsRate: data.tdsRate ?? 0,
        amountInBaseCurrency: (data.amount || 0) * (data.exchangeRate || 1),
        amountWithoutGst: data.amount || 0,
        projectId: data.projectId ? new Types.ObjectId(data.projectId) : undefined,
        clientId: data.clientId ? new Types.ObjectId(data.clientId) : undefined,
        createdBy: new Types.ObjectId(userId),
    });

    await revenue.save();
    return revenue;
};

// ── Get Revenues ────────────────────────────────────────────────────
export const getRevenues = async (filters: RevenueFilters) => {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (filters.source) query.source = filters.source;
    if (filters.status) query.status = filters.status;
    if (filters.projectId) query.projectId = new Types.ObjectId(filters.projectId);
    if (filters.clientId) query.clientId = new Types.ObjectId(filters.clientId);
    if (filters.year) query.accrualYear = filters.year;

    if (filters.startDate || filters.endDate) {
        query.$or = [
            {
                accrualYear: {
                    $gte: filters.startDate ? new Date(filters.startDate).getFullYear() : 1900,
                    $lte: filters.endDate ? new Date(filters.endDate).getFullYear() : 2100,
                },
            },
        ];
    }

    const [revenues, total] = await Promise.all([
        Revenue.find(query)
            .populate('projectId', 'name')
            .populate('clientId', 'name companyName')
            .populate('createdBy', 'name')
            .sort({ accrualYear: -1, accrualMonth: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Revenue.countDocuments(query),
    ]);

    return {
        revenues,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};

// ── Get Revenue by ID ───────────────────────────────────────────────
export const getRevenueById = async (id: string): Promise<IRevenue> => {
    const revenue = await Revenue.findById(id)
        .populate('projectId', 'name')
        .populate('clientId', 'name companyName')
        .populate('createdBy', 'name');

    if (!revenue) {
        throw new AppError('Revenue entry not found', 404);
    }

    return revenue;
};

// ── Update Revenue ──────────────────────────────────────────────────
export const updateRevenue = async (
    id: string,
    data: Partial<CreateRevenuePayload>
): Promise<IRevenue> => {
    const revenue = await Revenue.findById(id);
    if (!revenue) {
        throw new AppError('Revenue entry not found', 404);
    }

    // Only allow updates to manual revenue entries
    if (revenue.source === 'project' && revenue.invoiceId) {
        throw new AppError('Cannot modify invoice-linked revenue entries', 400);
    }

    Object.assign(revenue, data);
    await revenue.save();

    return revenue;
};

// ── Delete Revenue ──────────────────────────────────────────────────
export const deleteRevenue = async (id: string): Promise<void> => {
    const revenue = await Revenue.findById(id);
    if (!revenue) {
        throw new AppError('Revenue entry not found', 404);
    }

    // Only allow deletion of manual revenue entries
    if (revenue.source === 'project' && revenue.invoiceId) {
        throw new AppError('Cannot delete invoice-linked revenue entries', 400);
    }

    await revenue.deleteOne();
};

// ── Record Payment ──────────────────────────────────────────────────
export const recordRevenuePayment = async (
    id: string,
    amount: number,
    receivedDate?: Date
): Promise<IRevenue> => {
    const revenue = await Revenue.findById(id);
    if (!revenue) {
        throw new AppError('Revenue entry not found', 404);
    }

    const date = receivedDate || new Date();
    revenue.amountReceived = Math.min(
        revenue.amountReceived + amount,
        revenue.amountInBaseCurrency
    );
    revenue.receivedDate = date;
    revenue.cashMonth = date.getMonth() + 1;
    revenue.cashYear = date.getFullYear();

    await revenue.save();
    return revenue;
};

// ── Get Monthly Revenue ─────────────────────────────────────────────
export const getMonthlyRevenue = async (year: number) => {
    // Get manual revenue
    const manualRevenue = await Revenue.aggregate([
        {
            $match: {
                accrualYear: year,
                status: { $in: ['pending', 'received', 'partially_received'] },
            },
        },
        {
            $group: {
                _id: '$accrualMonth',
                total: { $sum: '$amountInBaseCurrency' },
                totalWithoutGst: { $sum: '$amountWithoutGst' },
                gst: { $sum: '$gstAmount' },
                received: { $sum: '$amountReceived' },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Get invoice-based revenue
    const invoiceRevenue = await Invoice.aggregate([
        {
            $match: {
                issueDate: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31`),
                },
                status: { $in: ['sent', 'partial', 'paid'] },
            },
        },
        {
            $group: {
                _id: { $month: '$issueDate' },
                total: { $sum: '$amountInBaseCurrency' },
                totalWithoutGst: { $sum: '$subtotal' },
                gst: { $sum: '$gstAmount' },
                received: { $sum: '$paidAmount' },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Merge data
    const manualMap = new Map(manualRevenue.map((r: any) => [r._id, r]));
    const invoiceMap = new Map(invoiceRevenue.map((r: any) => [r._id, r]));

    const months = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const manual = manualMap.get(month) || { total: 0, totalWithoutGst: 0, gst: 0, received: 0, count: 0 };
        const invoice = invoiceMap.get(month) || { total: 0, totalWithoutGst: 0, gst: 0, received: 0, count: 0 };

        return {
            month,
            totalRevenue: Math.round((manual.total + invoice.total) * 100) / 100,
            revenueWithoutGst: Math.round((manual.totalWithoutGst + invoice.totalWithoutGst) * 100) / 100,
            gst: Math.round((manual.gst + invoice.gst) * 100) / 100,
            received: Math.round((manual.received + invoice.received) * 100) / 100,
            manualRevenue: Math.round(manual.total * 100) / 100,
            invoiceRevenue: Math.round(invoice.total * 100) / 100,
        };
    });

    return months;
};

// ── Get Revenue Summary ─────────────────────────────────────────────
export const getRevenueSummary = async (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const startMonth = start.getMonth() + 1;
    const endMonth = end.getMonth() + 1;

    // Manual revenue summary
    const [manualAgg] = await Revenue.aggregate([
        {
            $match: {
                $or: [
                    { accrualYear: { $gt: startYear, $lt: endYear } },
                    { accrualYear: startYear, accrualMonth: { $gte: startMonth } },
                    { accrualYear: endYear, accrualMonth: { $lte: endMonth } },
                ],
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amountInBaseCurrency' },
                totalWithoutGst: { $sum: '$amountWithoutGst' },
                gst: { $sum: '$gstAmount' },
                received: { $sum: '$amountReceived' },
                pending: {
                    $sum: {
                        $subtract: ['$amountInBaseCurrency', '$amountReceived'],
                    },
                },
            },
        },
    ]);

    // Invoice revenue summary
    const [invoiceAgg] = await Invoice.aggregate([
        {
            $match: {
                issueDate: { $gte: start, $lte: end },
                status: { $in: ['sent', 'partial', 'paid'] },
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amountInBaseCurrency' },
                totalWithoutGst: { $sum: '$subtotal' },
                gst: { $sum: '$gstAmount' },
                received: { $sum: '$paidAmount' },
                pending: { $sum: { $subtract: ['$total', '$paidAmount'] } },
            },
        },
    ]);

    const manual = manualAgg || { total: 0, totalWithoutGst: 0, gst: 0, received: 0, pending: 0 };
    const invoice = invoiceAgg || { total: 0, totalWithoutGst: 0, gst: 0, received: 0, pending: 0 };

    return {
        totalRevenue: Math.round((manual.total + invoice.total) * 100) / 100,
        revenueWithoutGst: Math.round((manual.totalWithoutGst + invoice.totalWithoutGst) * 100) / 100,
        gstCollected: Math.round((manual.gst + invoice.gst) * 100) / 100,
        received: Math.round((manual.received + invoice.received) * 100) / 100,
        pending: Math.round((manual.pending + invoice.pending) * 100) / 100,
        manualRevenue: Math.round(manual.total * 100) / 100,
        invoiceRevenue: Math.round(invoice.total * 100) / 100,
    };
};
