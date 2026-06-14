import { Revenue, IRevenue } from '../models/Revenue.model';
import { Types, FilterQuery } from 'mongoose';
import { Project } from '../../project/models/Project.model';
import { ExchangeRateService } from './exchangeRate.service';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';
import { BankTransaction } from '../models/BankTransaction.model';
import { BankTransactionService } from './bankTransaction.service';

interface CreateRevenueData {
    date: Date;
    description: string;
    client: string;
    clientId?: Types.ObjectId;
    project?: string;
    projectId?: Types.ObjectId;
    phaseId?: Types.ObjectId;
    amount: number;
    currency?: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
    exchangeRate?: number;
    exchangeRateDate?: Date;
    exchangeRateProvider?: string;
    amountINR?: number;
    gst?: number;
    totalAmount?: number;
    pendingAmount?: number;
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

interface ReceivableItem {
    id: string;
    source: 'finance-revenue' | 'phase-payment';
    sourceLabel: string;
    party: string;
    title: string;
    status: 'pending' | 'partial' | 'overdue';
    dueDate: Date | null;
    outstanding: number;
    expected: number;
    received: number;
    currency: 'INR';
    originalCurrency?: string;
    originalExpected?: number;
    exchangeRate?: number;
    exchangeRateDate?: Date;
    exchangeRateProvider?: string;
    fxRateSource?: string;
    fxFallbackUsed?: boolean;
}

interface ReceivableWarning {
    code: 'FX_RATE_REQUIRED' | 'FX_FALLBACK_USED';
    message: string;
    source: 'phase-payment' | 'finance-revenue';
    projectId?: string;
    phaseId?: string;
    currency?: string;
    date?: string;
}

interface ReceivablesResult {
    items: ReceivableItem[];
    summary: {
        totalOpen: number;
        overdueAmount: number;
        dueSoonAmount: number;
        phaseAmount: number;
        financeAmount: number;
    };
    warnings: ReceivableWarning[];
    skippedCount: number;
}

const roundMoney = (value: number) => Math.round(Number(value || 0) * 100) / 100;

const firstFiniteNumber = (...values: unknown[]) => {
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric;
    }
    return 0;
};

const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getPhaseExpectedAmount = (phase: any, project: any) => {
    if (Number(phase?.paymentAmount || 0) > 0) return Number(phase.paymentAmount || 0);
    if (Number(phase?.paymentPercentage || 0) > 0 && Number(project?.budget || 0) > 0) {
        return (Number(project.budget || 0) * Number(phase.paymentPercentage || 0)) / 100;
    }
    return 0;
};

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
    private static getArchiveBatchId(options: ArchiveDeleteOptions = {}): string {
        return options.archiveBatchId ?? DeletedRecordService.generateArchiveBatchId();
    }

    /**
     * Create a new revenue entry
     */
    static async create(data: CreateRevenueData): Promise<IRevenue> {
        const currency = data.currency || 'INR';
        const conversion = await ExchangeRateService.convertToINR(data.amount, currency, data.date);
        const exchangeRate = conversion.rate;
        const amountINR = conversion.amountINR;

        const gstApplicable = data.gstApplicable ?? true;
        const gstRate = data.gstRate || 18;
        const gst = gstApplicable ? roundMoney((amountINR * gstRate) / 100) : 0;
        const tdsDeducted = data.tdsDeducted || 0;
        const totalAmount = roundMoney(amountINR + gst - tdsDeducted);

        const revenue = new Revenue({
            ...data,
            currency,
            exchangeRate,
            exchangeRateDate: conversion.date,
            exchangeRateProvider: conversion.provider,
            amountINR,
            gstApplicable,
            gstRate,
            gst,
            totalAmount,
            receivedAmount: roundMoney(data.receivedAmount || 0),
            pendingAmount: Math.max(0, roundMoney(totalAmount - (data.receivedAmount || 0))),
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
        const amount = data.amount ?? existing.amount;
        const date = data.date || existing.date;
        const conversion = await ExchangeRateService.convertToINR(amount, currency, date);
        const exchangeRate = conversion.rate;
        const amountINR = conversion.amountINR;

        const gstApplicable = data.gstApplicable ?? existing.gstApplicable;
        const gstRate = data.gstRate ?? existing.gstRate;
        const gst = gstApplicable ? roundMoney((amountINR * gstRate) / 100) : 0;
        const tdsDeducted = data.tdsDeducted ?? existing.tdsDeducted;
        const totalAmount = roundMoney(amountINR + gst - tdsDeducted);
        const receivedAmount = data.receivedAmount ?? existing.receivedAmount;

        return Revenue.findByIdAndUpdate(
            id,
            {
                ...data,
                currency,
                exchangeRate,
                exchangeRateDate: conversion.date,
                exchangeRateProvider: conversion.provider,
                amountINR,
                gstApplicable,
                gstRate,
                gst,
                totalAmount,
                receivedAmount,
                pendingAmount: Math.max(0, roundMoney(totalAmount - receivedAmount)),
            },
            { new: true }
        ).lean();
    }

    /**
     * Delete revenue
     */
    static async delete(id: Types.ObjectId | string, options: ArchiveDeleteOptions = {}): Promise<boolean> {
        const revenue = await Revenue.findById(id);
        if (!revenue) return false;

        const archiveBatchId = this.getArchiveBatchId(options);
        const linkedTransactions = await BankTransaction.find({ revenueId: revenue._id });

        if (!options.skipArchive) {
            await DeletedRecordService.archiveDocument(revenue, {
                archiveBatchId,
                deletedBy: options.deletedBy,
                reason: options.reason ?? 'Revenue delete requested',
                operation: 'delete',
                session: options.session,
                metadata: {
                    ...options.metadata,
                    revenueId: revenue._id.toString(),
                    projectId: revenue.projectId?.toString(),
                    phaseId: revenue.phaseId?.toString(),
                    clientId: revenue.clientId?.toString(),
                },
            });

            await DeletedRecordService.archiveDocuments(linkedTransactions, {
                archiveBatchId,
                deletedBy: options.deletedBy,
                reason: options.reason ?? 'Revenue delete requested',
                operation: 'delete',
                session: options.session,
                metadata: {
                    ...options.metadata,
                    revenueId: revenue._id.toString(),
                    linkedFrom: 'Revenue',
                },
            });
        }

        for (const transaction of linkedTransactions) {
            await BankTransactionService.delete(transaction._id, {
                ...options,
                archiveBatchId,
                skipArchive: true,
            });
        }

        await revenue.deleteOne(options.session ? { session: options.session } : undefined);
        return true;
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
            const amountINR = firstFiniteNumber(rev.amountINR, rev.amount);
            const receivedAmount = firstFiniteNumber(rev.receivedAmount);
            const pendingAmount = firstFiniteNumber(
                rev.pendingAmount,
                Math.max(0, firstFiniteNumber(rev.totalAmount, amountINR) - receivedAmount)
            );
            const gst = firstFiniteNumber(rev.gst);

            summary.totalRevenue += amountINR;
            summary.totalReceived += receivedAmount;
            summary.totalPending += pendingAmount;
            summary.totalGST += gst;

            summary.byStatus[rev.status] = (summary.byStatus[rev.status] || 0) + amountINR;
            summary.bySource[rev.source] = (summary.bySource[rev.source] || 0) + amountINR;
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
                    revenue: { $sum: { $ifNull: ['$amountINR', '$amount'] } },
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

    static async getReceivables(): Promise<ReceivablesResult> {
        const today = getStartOfDay(new Date());
        const warnings: ReceivableWarning[] = [];
        const openRevenueRecords = await Revenue.find({
            status: { $in: ['pending', 'partial', 'overdue'] },
        }).lean();

        const financeItems: ReceivableItem[] = openRevenueRecords
            .map((item: any): ReceivableItem | null => {
                const expected = Number(item.totalAmount || item.amountINR || item.amount || 0);
                const received = Number(item.receivedAmount || 0);
                const outstanding = Math.max(0, roundMoney(expected - received));
                if (outstanding <= 0) return null;

                const dueDate = item.dueDate ? getStartOfDay(new Date(item.dueDate)) : null;
                const status: ReceivableItem['status'] = dueDate && dueDate < today
                    ? 'overdue'
                    : (String(item.status || 'pending').toLowerCase() === 'partial' ? 'partial' : 'pending');

                return {
                    id: String(item._id || ''),
                    source: 'finance-revenue' as const,
                    sourceLabel: 'Finance Revenue',
                    party: String(item.client || 'Unknown client'),
                    title: String(item.description || item.invoiceNumber || 'Receivable'),
                    status,
                    dueDate,
                    outstanding,
                    expected: roundMoney(expected),
                    received: roundMoney(received),
                    currency: 'INR' as const,
                    originalCurrency: item.currency,
                    originalExpected: Number(item.amount || 0),
                    exchangeRate: item.exchangeRate,
                    exchangeRateDate: item.exchangeRateDate,
                    exchangeRateProvider: item.exchangeRateProvider,
                };
            })
            .filter((item): item is ReceivableItem => item !== null);

        const projects = await Project.find({ isArchived: false })
            .select('name budget currency phases')
            .lean();

        const phaseItemLists = await Promise.all(projects.flatMap((project: any) => {
            const phases = project.phases || [];
            return phases
                .filter((phase: any) => phase?.hasPayment)
                .map(async (phase: any, index: number): Promise<ReceivableItem | null> => {
                    const expectedOriginal = getPhaseExpectedAmount(phase, project);
                    if (expectedOriginal <= 0) return null;

                    const currency = phase.paymentCurrency || project.currency || 'INR';
                    const dueDateRaw = phase.paymentDueDate || phase.endDate || null;
                    const conversionDate = dueDateRaw ? new Date(dueDateRaw) : new Date();
                    const storedExpected = Number(phase.paymentExpectedAmountINR);
                    let conversion: Awaited<ReturnType<typeof ExchangeRateService.convertToINR>> | null = null;
                    let expected = Number.isFinite(storedExpected) && storedExpected > 0
                        ? roundMoney(storedExpected)
                        : 0;

                    if (expected <= 0) {
                        try {
                            conversion = await ExchangeRateService.convertToINR(expectedOriginal, currency, conversionDate, {
                                allowLatestFallback: true,
                            });
                            expected = conversion.amountINR;
                        } catch (error: any) {
                            warnings.push({
                                code: 'FX_RATE_REQUIRED',
                                message: error?.message || 'Manual exchange rate is required for this receivable',
                                source: 'phase-payment',
                                projectId: String(project?._id || ''),
                                phaseId: phase?._id ? String(phase._id) : undefined,
                                currency: String(currency || ''),
                                date: conversionDate.toISOString().slice(0, 10),
                            });
                            return null;
                        }
                    }

                    const fxFallbackUsed = Boolean(phase.paymentFxFallbackUsed || conversion?.fallbackUsed);
                    if (fxFallbackUsed) {
                        warnings.push({
                            code: 'FX_FALLBACK_USED',
                            message: 'Latest known FX rate used for phase receivable conversion',
                            source: 'phase-payment',
                            projectId: String(project?._id || ''),
                            phaseId: phase?._id ? String(phase._id) : undefined,
                            currency: String(currency || ''),
                            date: conversionDate.toISOString().slice(0, 10),
                        });
                    }

                    const gstApplicable = phase.gstApplicable ?? project.gstApplicable ?? true;
                    const gstRate = phase.gstRate ?? project.gstRate ?? 18;
                    // Match phasePayment.service.ts convention: isGstInclusive defaults to true
                    // (backward-compat: legacy phases without this field are treated as inclusive)
                    const isGstInclusive: boolean = phase.isGstInclusive !== false;
                    // Only add GST on top when it is NOT inclusive (exclusive contract: GST charged separately)
                    const gst = (gstApplicable && !isGstInclusive) ? roundMoney((expected * gstRate) / 100) : 0;
                    const tdsDeducted = roundMoney(Number(phase.tdsDeducted ?? 0));
                    const totalExpected = roundMoney(expected + gst - tdsDeducted);

                    const received = roundMoney(Number(phase.paymentReceivedAmountINR ?? phase.paymentReceivedAmount ?? 0));
                    const outstanding = Math.max(0, roundMoney(totalExpected - received));
                    const statusRaw = String(phase.paymentStatus || 'pending').toLowerCase();

                    if (outstanding <= 0 || !['pending', 'partial'].includes(statusRaw)) return null;

                    const dueDate = dueDateRaw ? getStartOfDay(new Date(dueDateRaw)) : null;
                    const status = dueDate && dueDate < today
                        ? 'overdue'
                        : (statusRaw === 'partial' ? 'partial' : 'pending');

                    return {
                        id: `${String(project?._id || 'project')}-${String(phase?._id || index)}`,
                        source: 'phase-payment',
                        sourceLabel: 'Project Phase',
                        party: String(project?.name || 'Project'),
                        title: `Phase: ${String(phase?.name || 'Unnamed')}`,
                        status,
                        dueDate,
                        outstanding,
                        expected: totalExpected,
                        received,
                        currency: 'INR',
                        originalCurrency: currency,
                        originalExpected: roundMoney(expectedOriginal),
                        exchangeRate: phase.paymentExchangeRate || conversion?.rate,
                        exchangeRateDate: phase.paymentExchangeRateDate || conversion?.date,
                        exchangeRateProvider: phase.paymentFxRateSource || conversion?.provider || 'frankfurter',
                        fxRateSource: phase.paymentFxRateSource || conversion?.source,
                        fxFallbackUsed,
                    };
                });
        }));

        const phaseItems = phaseItemLists.filter((item): item is ReceivableItem => Boolean(item));
        const items = [...financeItems, ...phaseItems].sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.getTime() - b.dueDate.getTime();
        });

        const totalOpen = items.reduce((sum, item) => sum + item.outstanding, 0);
        const overdueAmount = items
            .filter((item) => item.dueDate && item.dueDate < today)
            .reduce((sum, item) => sum + item.outstanding, 0);
        const dueSoonAmount = items
            .filter((item) => {
                if (!item.dueDate) return false;
                const diff = Math.ceil((item.dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                return diff >= 0 && diff <= 7;
            })
            .reduce((sum, item) => sum + item.outstanding, 0);
        const phaseAmount = items
            .filter((item) => item.source === 'phase-payment')
            .reduce((sum, item) => sum + item.outstanding, 0);

        return {
            items,
            summary: {
                totalOpen: roundMoney(totalOpen),
                overdueAmount: roundMoney(overdueAmount),
                dueSoonAmount: roundMoney(dueSoonAmount),
                phaseAmount: roundMoney(phaseAmount),
                financeAmount: roundMoney(totalOpen - phaseAmount),
            },
            warnings,
            skippedCount: warnings.filter((warning) => warning.code === 'FX_RATE_REQUIRED').length,
        };
    }
}
