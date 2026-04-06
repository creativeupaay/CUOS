import { Invoice } from '../models/Invoice.model';
import { Expense } from '../models/Expense.model';
import { Payroll } from '../../hrms/models/Payroll.model';
import { PaymentMilestone } from '../models/PaymentMilestone.model';
import { Project } from '../../project/models/Project.model';
import { Revenue } from '../models/Revenue.model';

export interface CompanyDashboardStats {
    // Revenue
    totalRevenue: number;        // with GST
    revenueWithoutGst: number;
    totalGstCollected: number;
    totalPaid: number;
    totalPending: number;       // Receivables

    // Expenses
    payrollCost: number;
    fixedCosts: number;
    variableCosts: number;
    cac: number;
    projectCosts: number;
    overheadCosts: number;
    totalExpenses: number;
    depreciation: number;
    interestExpense: number;
    taxExpense: number;

    // Profitability
    grossProfit: number;
    grossMargin: number;
    ebitda: number;
    ebitdaMargin: number;
    netProfit: number;
    netMargin: number;

    // Cash Position
    cashInBank: number;
    receivables: number;
    payables: number;

    // Runway
    runwayMonths: number;       // Cash / Avg Monthly Expenses
    avgMonthlyExpenses: number;

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
    const [invoiceRevenueAgg] = await Invoice.aggregate([
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

    // ─── Revenue from Manual entries ──────────────────────────────
    const startMonth = start.getMonth() + 1;
    const startYear = start.getFullYear();
    const endMonth = end.getMonth() + 1;
    const endYear = end.getFullYear();

    const [manualRevenueAgg] = await Revenue.aggregate([
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
                totalRevenue: { $sum: '$amountInBaseCurrency' },
                totalGst: { $sum: '$gstAmount' },
                totalWithoutGst: { $sum: '$amountWithoutGst' },
                totalPaid: { $sum: '$amountReceived' },
            },
        },
    ]);

    // Combine invoice and manual revenue
    const invoiceRevenue = invoiceRevenueAgg || { totalRevenue: 0, totalGst: 0, totalSubtotal: 0, totalPaid: 0, count: 0 };
    const manualRevenue = manualRevenueAgg || { totalRevenue: 0, totalGst: 0, totalWithoutGst: 0, totalPaid: 0 };

    const totalRevenue = (invoiceRevenue.totalRevenue || 0) + (manualRevenue.totalRevenue || 0);
    const revenueWithoutGst = (invoiceRevenue.totalSubtotal || 0) + (manualRevenue.totalWithoutGst || 0);
    const totalGstCollected = (invoiceRevenue.totalGst || 0) + (manualRevenue.totalGst || 0);
    const totalPaid = (invoiceRevenue.totalPaid || 0) + (manualRevenue.totalPaid || 0);
    const totalPending = totalRevenue - totalPaid;
    const totalInvoices = invoiceRevenue.count || 0;

    // Overdue invoices
    const overdueCount = await Invoice.countDocuments({
        dueDate: { $lt: new Date() },
        status: { $in: ['sent', 'partial'] },
    });

    // ─── Payroll Cost ──────────────────────────────────────────────
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

    // ─── Expenses by Category and Cost Type ───────────────────────
    const expenseAgg = await Expense.aggregate([
        {
            $match: {
                date: { $gte: start, $lte: end },
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: { category: '$category', costType: '$costType' },
                total: { $sum: '$amountInBaseCurrency' },
            },
        },
    ]);

    const expensesByCategory: Record<string, number> = {};
    let totalFixedCosts = 0;
    let totalVariableCosts = 0;

    expenseAgg.forEach((e: any) => {
        const category = e._id.category;
        const costType = e._id.costType || 'variable';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + e.total;

        if (costType === 'fixed') {
            totalFixedCosts += e.total;
        } else {
            totalVariableCosts += e.total;
        }
    });

    const fixedCosts = expensesByCategory['fixed'] || 0;
    const cac = expensesByCategory['cac'] || 0;
    const projectCosts = expensesByCategory['project'] || 0;
    const overheadCosts = expensesByCategory['overhead'] || 0;
    const taxExpense = expensesByCategory['tax'] || 0;
    const transactionFees = expensesByCategory['transaction-fee'] || 0;
    const currencyLosses = expensesByCategory['currency-loss'] || 0;
    const salaryCategoryExpense = expensesByCategory['salary'] || 0;

    // Total operating expenses (excluding tax, depreciation, interest)
    const operatingExpenses =
        payrollCost + fixedCosts + cac + projectCosts + overheadCosts +
        transactionFees + currencyLosses + salaryCategoryExpense;

    const totalExpenses = operatingExpenses + taxExpense;

    // ─── Projects ──────────────────────────────────────────────────
    const totalProjects = await Project.countDocuments({ isArchived: false });
    const activeProjects = await Project.countDocuments({
        isArchived: false,
        status: 'active',
    });

    // ─── Profitability Metrics ────────────────────────────────────
    // Gross Profit = Revenue - Direct Costs (project costs + payroll allocated to projects)
    const directCosts = projectCosts + (payrollCost * 0.7); // Assuming 70% of payroll is direct cost
    const grossProfit = revenueWithoutGst - directCosts;
    const grossMargin = revenueWithoutGst > 0 ? (grossProfit / revenueWithoutGst) * 100 : 0;

    // EBITDA = Revenue - Operating Expenses (excluding depreciation, interest, tax)
    const depreciation = 0; // Would need depreciation tracking
    const interestExpense = 0; // Would need interest tracking
    const ebitda = revenueWithoutGst - operatingExpenses;
    const ebitdaMargin = revenueWithoutGst > 0 ? (ebitda / revenueWithoutGst) * 100 : 0;

    // Net Profit = Revenue - All Expenses
    const netProfit = revenueWithoutGst - totalExpenses;
    const netMargin = revenueWithoutGst > 0 ? (netProfit / revenueWithoutGst) * 100 : 0;

    // ─── Cash Position ────────────────────────────────────────────
    // Cash in Bank = Total Paid (received) - Total Paid Out (expenses marked as paid)
    const [paidExpensesAgg] = await Expense.aggregate([
        {
            $match: {
                date: { $gte: start, $lte: end },
                status: 'paid',
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amountInBaseCurrency' },
            },
        },
    ]);

    const paidExpenses = paidExpensesAgg?.total || 0;
    const cashInBank = totalPaid - paidExpenses - payrollCost;
    const receivables = totalPending;
    const payables = totalExpenses - paidExpenses; // Approved but not paid

    // ─── Runway Calculation ────────────────────────────────────────
    // Calculate average monthly expenses over last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [avgExpenseAgg] = await Expense.aggregate([
        {
            $match: {
                date: { $gte: sixMonthsAgo, $lte: new Date() },
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' },
                },
                monthlyTotal: { $sum: '$amountInBaseCurrency' },
            },
        },
        {
            $group: {
                _id: null,
                avgMonthlyExpenses: { $avg: '$monthlyTotal' },
                monthCount: { $sum: 1 },
            },
        },
    ]);

    // Also include payroll in average
    const [avgPayrollAgg] = await Payroll.aggregate([
        {
            $match: {
                $expr: {
                    $gte: [
                        { $dateFromParts: { year: '$year', month: '$month', day: 1 } },
                        sixMonthsAgo,
                    ],
                },
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: { year: '$year', month: '$month' },
                monthlyTotal: { $sum: '$netSalary' },
            },
        },
        {
            $group: {
                _id: null,
                avgMonthlyPayroll: { $avg: '$monthlyTotal' },
            },
        },
    ]);

    const avgMonthlyExpenses = (avgExpenseAgg?.avgMonthlyExpenses || 0) + (avgPayrollAgg?.avgMonthlyPayroll || 0);
    const runwayMonths = avgMonthlyExpenses > 0 ? cashInBank / avgMonthlyExpenses : 0;

    return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        revenueWithoutGst: Math.round(revenueWithoutGst * 100) / 100,
        totalGstCollected: Math.round(totalGstCollected * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        payrollCost: Math.round(payrollCost * 100) / 100,
        fixedCosts: Math.round(totalFixedCosts * 100) / 100,
        variableCosts: Math.round(totalVariableCosts * 100) / 100,
        cac: Math.round(cac * 100) / 100,
        projectCosts: Math.round(projectCosts * 100) / 100,
        overheadCosts: Math.round(overheadCosts * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        depreciation: Math.round(depreciation * 100) / 100,
        interestExpense: Math.round(interestExpense * 100) / 100,
        taxExpense: Math.round(taxExpense * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossMargin: Math.round(grossMargin * 100) / 100,
        ebitda: Math.round(ebitda * 100) / 100,
        ebitdaMargin: Math.round(ebitdaMargin * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        netMargin: Math.round(netMargin * 100) / 100,
        cashInBank: Math.round(cashInBank * 100) / 100,
        receivables: Math.round(receivables * 100) / 100,
        payables: Math.round(payables * 100) / 100,
        runwayMonths: Math.round(runwayMonths * 10) / 10,
        avgMonthlyExpenses: Math.round(avgMonthlyExpenses * 100) / 100,
        totalProjects,
        activeProjects,
        totalInvoices,
        overdueInvoices: overdueCount,
    };
};

/**
 * Get month-on-month report for a fiscal year (April-March)
 * @param fiscalYear - The starting year of the fiscal year (e.g., 2025 for FY 2025-26)
 */
export const getMonthlyReport = async (fiscalYear: number) => {
    // Fiscal year: April of fiscalYear to March of fiscalYear+1
    const fiscalStart = new Date(`${fiscalYear}-04-01`);
    const fiscalEnd = new Date(`${fiscalYear + 1}-03-31T23:59:59.999Z`);

    // Monthly revenue from invoices
    const revenueByMonth = await Invoice.aggregate([
        {
            $match: {
                issueDate: { $gte: fiscalStart, $lte: fiscalEnd },
                status: { $in: ['sent', 'partial', 'paid'] },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: '$issueDate' },
                    month: { $month: '$issueDate' },
                },
                revenue: { $sum: '$amountInBaseCurrency' },
                gst: { $sum: '$gstAmount' },
                revenueWithoutGst: { $sum: '$subtotal' },
                paid: { $sum: '$paidAmount' },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Monthly expenses
    const expensesByMonth = await Expense.aggregate([
        {
            $match: {
                date: { $gte: fiscalStart, $lte: fiscalEnd },
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' },
                },
                expenses: { $sum: '$amountInBaseCurrency' },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Monthly payroll - handle fiscal year spanning two calendar years
    const payrollByMonth = await Payroll.aggregate([
        {
            $match: {
                $or: [
                    // April to December of fiscalYear
                    { year: fiscalYear, month: { $gte: 4, $lte: 12 } },
                    // January to March of fiscalYear+1
                    { year: fiscalYear + 1, month: { $gte: 1, $lte: 3 } },
                ],
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: { year: '$year', month: '$month' },
                payroll: { $sum: '$netSalary' },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Create maps for quick lookup
    const revenueMap = new Map(
        revenueByMonth.map((r: any) => [`${r._id.year}-${r._id.month}`, r])
    );
    const expenseMap = new Map(
        expensesByMonth.map((e: any) => [`${e._id.year}-${e._id.month}`, e])
    );
    const payrollMap = new Map(
        payrollByMonth.map((p: any) => [`${p._id.year}-${p._id.month}`, p])
    );

    // Generate 12 months in fiscal year order (April to March)
    const fiscalMonths: { calendarYear: number; month: number; displayLabel: string }[] = [];
    for (let i = 0; i < 12; i++) {
        // Start from April (month 4)
        const month = ((i + 3) % 12) + 1; // 4,5,6,7,8,9,10,11,12,1,2,3
        const calendarYear = month >= 4 ? fiscalYear : fiscalYear + 1;
        fiscalMonths.push({ calendarYear, month, displayLabel: `${month}/${calendarYear}` });
    }

    const months = fiscalMonths.map((fm, index) => {
        const key = `${fm.calendarYear}-${fm.month}`;
        const rev = revenueMap.get(key) || { revenue: 0, gst: 0, revenueWithoutGst: 0, paid: 0 };
        const exp = expenseMap.get(key) || { expenses: 0 };
        const pay = payrollMap.get(key) || { payroll: 0 };
        const totalExpenses = exp.expenses + pay.payroll;
        const netProfit = rev.revenueWithoutGst - totalExpenses;

        return {
            month: fm.month,
            fiscalMonthIndex: index + 1, // 1-12 representing April-March
            calendarYear: fm.calendarYear,
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

/**
 * Get monthly salaries breakdown for a fiscal year
 */
export const getMonthlySalaries = async (fiscalYear: number) => {
    // Fiscal year payroll - April of fiscalYear to March of fiscalYear+1
    const payrollByMonth = await Payroll.aggregate([
        {
            $match: {
                $or: [
                    { year: fiscalYear, month: { $gte: 4, $lte: 12 } },
                    { year: fiscalYear + 1, month: { $gte: 1, $lte: 3 } },
                ],
                status: { $in: ['approved', 'paid'] },
            },
        },
        {
            $group: {
                _id: { year: '$year', month: '$month' },
                totalSalary: { $sum: '$netSalary' },
                employeeCount: { $sum: 1 },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const payrollMap = new Map(
        payrollByMonth.map((p: any) => [`${p._id.year}-${p._id.month}`, p])
    );

    // Generate fiscal year months
    const fiscalMonths: { calendarYear: number; month: number }[] = [];
    for (let i = 0; i < 12; i++) {
        const month = ((i + 3) % 12) + 1;
        const calendarYear = month >= 4 ? fiscalYear : fiscalYear + 1;
        fiscalMonths.push({ calendarYear, month });
    }

    return fiscalMonths.map((fm, index) => {
        const key = `${fm.calendarYear}-${fm.month}`;
        const pay = payrollMap.get(key) || { totalSalary: 0, employeeCount: 0 };
        return {
            month: fm.month,
            fiscalMonthIndex: index + 1,
            calendarYear: fm.calendarYear,
            totalSalary: Math.round(pay.totalSalary * 100) / 100,
            employeeCount: pay.employeeCount,
        };
    });
};

/**
 * Get project profitability with "profitable until" calculation
 * Calculates: current profitability, cost burn rate, and predicts when it becomes unprofitable
 */
export const getProjectProfitability = async () => {
    // Get all active non-archived projects
    const projects = await Project.find({
        isArchived: false,
        status: { $in: ['active', 'on-hold'] },
    }).populate('client', 'name companyName').lean();

    const projectProfitability = await Promise.all(
        projects.map(async (project: any) => {
            const projectId = project._id.toString();

            // Get total invoiced revenue for this project
            const [revenueAgg] = await Invoice.aggregate([
                {
                    $match: {
                        projectId: project._id,
                        status: { $in: ['sent', 'partial', 'paid'] },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalInvoiced: { $sum: '$subtotal' },
                        totalPaid: { $sum: '$paidAmount' },
                    },
                },
            ]);

            // Get manual revenue entries for this project
            const [manualRevenueAgg] = await Revenue.aggregate([
                {
                    $match: { projectId: project._id },
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amountWithoutGst' },
                    },
                },
            ]);

            // Get project expenses
            const [expenseAgg] = await Expense.aggregate([
                {
                    $match: {
                        projectId: project._id,
                        status: { $in: ['approved', 'paid'] },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalExpenses: { $sum: '$amountInBaseCurrency' },
                    },
                },
            ]);

            const totalRevenue = (revenueAgg?.totalInvoiced || 0) + (manualRevenueAgg?.totalRevenue || 0);
            const totalExpenses = expenseAgg?.totalExpenses || 0;
            const profit = totalRevenue - totalExpenses;
            const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

            // Calculate monthly burn rate (average expenses per month)
            const projectStartDate = project.startDate ? new Date(project.startDate) : new Date(project.createdAt);
            const now = new Date();
            const monthsActive = Math.max(1,
                (now.getFullYear() - projectStartDate.getFullYear()) * 12 +
                (now.getMonth() - projectStartDate.getMonth())
            );
            const monthlyBurnRate = totalExpenses / monthsActive;

            // Calculate monthly revenue rate
            const monthlyRevenueRate = totalRevenue / monthsActive;

            // Calculate "profitable until" date
            let profitableUntil: string | null = null;
            let isProfitable = profit > 0;

            if (project.endDate) {
                const endDate = new Date(project.endDate);
                const remainingMonths = Math.max(0,
                    (endDate.getFullYear() - now.getFullYear()) * 12 +
                    (endDate.getMonth() - now.getMonth())
                );

                // Project future costs and revenue
                const projectedFutureCost = monthlyBurnRate * remainingMonths;
                const projectedFutureRevenue = monthlyRevenueRate * remainingMonths;
                const projectedProfit = profit + projectedFutureRevenue - projectedFutureCost;

                if (profit > 0 && monthlyBurnRate > monthlyRevenueRate) {
                    // Calculate when profit turns negative
                    const monthsUntilUnprofitable = profit / (monthlyBurnRate - monthlyRevenueRate);
                    const unprofitableDate = new Date();
                    unprofitableDate.setMonth(unprofitableDate.getMonth() + Math.floor(monthsUntilUnprofitable));

                    // If unprofitable date is before project end, use that date
                    if (unprofitableDate < endDate) {
                        profitableUntil = unprofitableDate.toISOString().split('T')[0];
                    } else {
                        profitableUntil = endDate.toISOString().split('T')[0];
                    }
                } else if (isProfitable) {
                    // Project remains profitable until end date
                    profitableUntil = endDate.toISOString().split('T')[0];
                }
            }

            return {
                projectId,
                projectName: project.name,
                clientName: project.client?.companyName || project.client?.name || 'N/A',
                status: project.status,
                startDate: project.startDate,
                endDate: project.endDate,
                budget: project.budget || 0,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalExpenses: Math.round(totalExpenses * 100) / 100,
                profit: Math.round(profit * 100) / 100,
                profitMargin: Math.round(profitMargin * 10) / 10,
                isProfitable,
                monthlyBurnRate: Math.round(monthlyBurnRate * 100) / 100,
                monthlyRevenueRate: Math.round(monthlyRevenueRate * 100) / 100,
                profitableUntil,
            };
        })
    );

    // Sort by profit margin descending
    return projectProfitability.sort((a, b) => b.profitMargin - a.profitMargin);
};
