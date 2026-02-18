import { Invoice, IInvoice } from '../models/Invoice.model';
import AppError from '../../../utils/appError';

interface InvoiceFilters {
    projectId?: string;
    clientId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

/**
 * Generate next invoice number (INV-YYYY-NNN)
 */
const generateInvoiceNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const lastInvoice = await Invoice.findOne({
        invoiceNumber: { $regex: `^${prefix}` },
    })
        .sort({ invoiceNumber: -1 })
        .select('invoiceNumber');

    let nextNum = 1;
    if (lastInvoice) {
        const lastNum = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10);
        nextNum = lastNum + 1;
    }

    return `${prefix}${String(nextNum).padStart(3, '0')}`;
};

/**
 * Create a new invoice
 */
export const createInvoice = async (
    data: Partial<IInvoice>,
    userId: string
): Promise<IInvoice> => {
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = new Invoice({
        ...data,
        invoiceNumber,
        createdBy: userId,
    });

    await invoice.save(); // Pre-save hook computes totals
    return invoice;
};

/**
 * Get all invoices with filters
 */
export const getInvoices = async (filters: InvoiceFilters) => {
    const { projectId, clientId, status, startDate, endDate, page = 1, limit = 20 } = filters;

    const query: any = {};
    if (projectId) query.projectId = projectId;
    if (clientId) query.clientId = clientId;
    if (status) query.status = status;
    if (startDate || endDate) {
        query.issueDate = {};
        if (startDate) query.issueDate.$gte = new Date(startDate);
        if (endDate) query.issueDate.$lte = new Date(endDate);
    }

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
        .populate('projectId', 'name')
        .populate('clientId', 'name companyName')
        .populate('createdBy', 'name')
        .sort({ issueDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    return {
        invoices,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
};

/**
 * Get invoice by ID
 */
export const getInvoiceById = async (id: string): Promise<IInvoice> => {
    const invoice = await Invoice.findById(id)
        .populate('projectId', 'name')
        .populate('clientId', 'name companyName email')
        .populate('createdBy', 'name');

    if (!invoice) throw new AppError('Invoice not found', 404);
    return invoice;
};

/**
 * Update an invoice
 */
export const updateInvoice = async (
    id: string,
    data: Partial<IInvoice>
): Promise<IInvoice> => {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status === 'paid') {
        throw new AppError('Cannot edit a paid invoice', 400);
    }

    Object.assign(invoice, data);
    await invoice.save();
    return invoice;
};

/**
 * Delete an invoice (only drafts)
 */
export const deleteInvoice = async (id: string): Promise<void> => {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status !== 'draft') {
        throw new AppError('Only draft invoices can be deleted', 400);
    }
    await Invoice.findByIdAndDelete(id);
};

/**
 * Record a payment against an invoice
 */
export const recordPayment = async (
    id: string,
    amount: number
): Promise<IInvoice> => {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new AppError('Invoice not found', 404);

    invoice.paidAmount = (invoice.paidAmount || 0) + amount;
    if (invoice.paidAmount >= invoice.total) {
        invoice.paidAt = new Date();
    }
    await invoice.save(); // Pre-save hook updates status
    return invoice;
};

/**
 * Get revenue summary for a date range
 */
export const getRevenueSummary = async (startDate: string, endDate: string) => {
    const result = await Invoice.aggregate([
        {
            $match: {
                issueDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                },
                status: { $in: ['sent', 'partial', 'paid'] },
            },
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$amountInBaseCurrency' },
                totalGst: { $sum: '$gstAmount' },
                totalTds: { $sum: '$tdsAmount' },
                totalSubtotal: { $sum: '$subtotal' },
                paidRevenue: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'paid'] }, '$amountInBaseCurrency', 0],
                    },
                },
                pendingRevenue: {
                    $sum: {
                        $cond: [
                            { $in: ['$status', ['sent', 'partial']] },
                            { $subtract: ['$total', '$paidAmount'] },
                            0,
                        ],
                    },
                },
                invoiceCount: { $sum: 1 },
            },
        },
    ]);

    return result[0] || {
        totalRevenue: 0,
        totalGst: 0,
        totalTds: 0,
        totalSubtotal: 0,
        paidRevenue: 0,
        pendingRevenue: 0,
        invoiceCount: 0,
    };
};

/**
 * Get monthly revenue for a year
 */
export const getMonthlyRevenue = async (year: number) => {
    const result = await Invoice.aggregate([
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
                totalRevenue: { $sum: '$amountInBaseCurrency' },
                totalGst: { $sum: '$gstAmount' },
                revenueWithoutGst: { $sum: '$subtotal' },
                paidAmount: { $sum: '$paidAmount' },
                invoiceCount: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return result;
};

/**
 * Get overdue invoices
 */
export const getOverdueInvoices = async () => {
    const today = new Date();
    const invoices = await Invoice.find({
        dueDate: { $lt: today },
        status: { $in: ['sent', 'partial'] },
    })
        .populate('projectId', 'name')
        .populate('clientId', 'name companyName')
        .sort({ dueDate: 1 });

    return invoices;
};
