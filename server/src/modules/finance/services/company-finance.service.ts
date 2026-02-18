import { Invoice } from '../models/Invoice.model';
import { Expense } from '../models/Expense.model';
import { Payroll } from '../../hrms/models/Payroll.model';
import { PaymentMilestone } from '../models/PaymentMilestone.model';
import { Project } from '../../project/models/Project.model';

export interface CompanyDashboardStats {
    // Revenue
    totalRevenue: number;        // with GST
    revenueWithoutGst: number;
    totalGstCollected: number;
    totalPaid: number;
    totalPending: number;

    // Expenses
    payrollCost: number;
    fixedCosts: number;
    cac: number;
    projectCosts: number;
    overheadCosts: number;
    totalExpenses: number;

    // Profitability
    netProfit: number;
    netMargin: number;

    // Counts
    totalProjects: number;
    activeProjects: number;
    totalInvoices: number;
    overdueInvoices: number;
}

/**
 * Get company-level dashboard statistics for a date range
 */
export const getDashboardStats = async (
    startDate: string,
    endDate: string
): Promise<CompanyDashboardStats> => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // ─── Revenue from Invoices ─────────────────────────────────────
    const [revenueAgg] = await Invoice.aggregate([
        {
            $match: {
                issueDate: { $gte: start, $lte: end },
                status: { $in: ['sent', 'partial', 'paid'] },
            },
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$amountInBaseCurrency' },
                totalGst: { $sum: '$gstAmount' },
                totalSubtotal: { $sum: '$subtotal' },
                totalPaid: { $sum: '$paidAmount' },
                count: { $sum: 1 },
            },
        },
    ]);

    const totalRevenue = revenueAgg?.totalRevenue || 0;
    const revenueWithoutGst = revenueAgg?.totalSubtotal || 0;
    const totalGstCollected = revenueAgg?.totalGst || 0;
    const totalPaid = revenueAgg?.totalPaid || 0;
    const totalPending = totalRevenue - totalPaid;
    const totalInvoices = revenueAgg?.count || 0;

    // Overdue invoices
    const overdueCount = await Invoice.countDocuments({
        dueDate: { $lt: new Date() },
        status: { $in: ['sent', 'partial'] },
    });

    // ─── Payroll Cost ──────────────────────────────────────────────
    const startMonth = start.getMonth() + 1;
    const startYear = start.getFullYear();
    const endMonth = end.getMonth() + 1;
    const endYear = end.getFullYear();

    const [payrollAgg] = await Payroll.aggregate([
        {
            $match: {
                $or: [
                    { year: { $gt: startYear, $lt: endYear } },
                    { year: startYear, month: { $gte: startMonth } },
                    { year: endYear, month: { $lte: endMonth } },
                ],
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: null,
                totalPayroll: { $sum: '$netSalary' },
            },
        },
    ]);

    const payrollCost = payrollAgg?.totalPayroll || 0;

    // ─── Expenses by Category ──────────────────────────────────────
    const expenseAgg = await Expense.aggregate([
        {
            $match: {
                date: { $gte: start, $lte: end },
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: '$category',
                total: { $sum: '$amountInBaseCurrency' },
            },
        },
    ]);

    const expensesByCategory: Record<string, number> = {};
    expenseAgg.forEach((e: any) => {
        expensesByCategory[e._id] = e.total;
    });

    const fixedCosts = expensesByCategory['fixed'] || 0;
    const cac = expensesByCategory['cac'] || 0;
    const projectCosts = expensesByCategory['project'] || 0;
    const overheadCosts = expensesByCategory['overhead'] || 0;

    const totalExpenses =
        payrollCost + fixedCosts + cac + projectCosts + overheadCosts +
        (expensesByCategory['tax'] || 0) +
        (expensesByCategory['transaction-fee'] || 0) +
        (expensesByCategory['currency-loss'] || 0) +
        (expensesByCategory['salary'] || 0);

    // ─── Projects ──────────────────────────────────────────────────
    const totalProjects = await Project.countDocuments({ isArchived: false });
    const activeProjects = await Project.countDocuments({
        isArchived: false,
        status: 'active',
    });

    // ─── Profitability ─────────────────────────────────────────────
    const netProfit = revenueWithoutGst - totalExpenses;
    const netMargin = revenueWithoutGst > 0 ? (netProfit / revenueWithoutGst) * 100 : 0;

    return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        revenueWithoutGst: Math.round(revenueWithoutGst * 100) / 100,
        totalGstCollected: Math.round(totalGstCollected * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        payrollCost: Math.round(payrollCost * 100) / 100,
        fixedCosts: Math.round(fixedCosts * 100) / 100,
        cac: Math.round(cac * 100) / 100,
        projectCosts: Math.round(projectCosts * 100) / 100,
        overheadCosts: Math.round(overheadCosts * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        netMargin: Math.round(netMargin * 100) / 100,
        totalProjects,
        activeProjects,
        totalInvoices,
        overdueInvoices: overdueCount,
    };
};

/**
 * Get month-on-month report for a year
 */
export const getMonthlyReport = async (year: number) => {
    // Monthly revenue
    const revenueByMonth = await Invoice.aggregate([
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
                revenue: { $sum: '$amountInBaseCurrency' },
                gst: { $sum: '$gstAmount' },
                revenueWithoutGst: { $sum: '$subtotal' },
                paid: { $sum: '$paidAmount' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Monthly expenses
    const expensesByMonth = await Expense.aggregate([
        {
            $match: {
                date: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31`),
                },
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: { $month: '$date' },
                expenses: { $sum: '$amountInBaseCurrency' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Monthly payroll
    const payrollByMonth = await Payroll.aggregate([
        {
            $match: {
                year: year,
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: '$month',
                payroll: { $sum: '$netSalary' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Merge into a 12-month array
    const revenueMap = new Map(revenueByMonth.map((r: any) => [r._id, r]));
    const expenseMap = new Map(expensesByMonth.map((e: any) => [e._id, e]));
    const payrollMap = new Map(payrollByMonth.map((p: any) => [p._id, p]));

    const months = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const rev = revenueMap.get(month) || { revenue: 0, gst: 0, revenueWithoutGst: 0, paid: 0 };
        const exp = expenseMap.get(month) || { expenses: 0 };
        const pay = payrollMap.get(month) || { payroll: 0 };
        const totalExpenses = exp.expenses + pay.payroll;
        const netProfit = rev.revenueWithoutGst - totalExpenses;

        return {
            month,
            revenue: Math.round(rev.revenue * 100) / 100,
            gst: Math.round(rev.gst * 100) / 100,
            revenueWithoutGst: Math.round(rev.revenueWithoutGst * 100) / 100,
            cashReceived: Math.round(rev.paid * 100) / 100,
            expenses: Math.round(exp.expenses * 100) / 100,
            payroll: Math.round(pay.payroll * 100) / 100,
            totalExpenses: Math.round(totalExpenses * 100) / 100,
            netProfit: Math.round(netProfit * 100) / 100,
            netMargin: rev.revenueWithoutGst > 0
                ? Math.round((netProfit / rev.revenueWithoutGst) * 10000) / 100
                : 0,
        };
    });

    return months;
};

/**
 * Get accrual vs cashflow metrics for a date range
 */
export const getAccrualVsCashflow = async (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Accrual: invoices issued (regardless of payment status)
    const accrualRevenue = await Invoice.aggregate([
        {
            $match: {
                issueDate: { $gte: start, $lte: end },
                status: { $in: ['sent', 'partial', 'paid'] },
            },
        },
        {
            $group: {
                _id: { $month: '$issueDate' },
                accrual: { $sum: '$subtotal' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Cash: actual payments received
    const cashRevenue = await Invoice.aggregate([
        {
            $match: {
                paidAt: { $gte: start, $lte: end },
                status: 'paid',
            },
        },
        {
            $group: {
                _id: { $month: '$paidAt' },
                cash: { $sum: '$paidAmount' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const accrualMap = new Map(accrualRevenue.map((a: any) => [a._id, a.accrual]));
    const cashMap = new Map(cashRevenue.map((c: any) => [c._id, c.cash]));

    const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        accrualRevenue: Math.round((accrualMap.get(i + 1) || 0) * 100) / 100,
        cashRevenue: Math.round((cashMap.get(i + 1) || 0) * 100) / 100,
    }));

    return months;
};
