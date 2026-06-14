import { RevenueService } from './revenue.service';
import { ExpenseService } from './expense.service';
import { BankAccount } from '../models/BankAccount.model';
import { BankTransaction } from '../models/BankTransaction.model';
import { Revenue } from '../models/Revenue.model';
import { Expense } from '../models/Expense.model';

interface DashboardMetrics {
    totalRevenue: number;
    totalExpense: number;
    ebidta: number;
    runwayLeft: number;
    cashInBank: number;
    receivables: number;
    moneyInBank: number;
    gstPayable: number;
}

interface MonthlyChartData {
    month: string;
    revenue: number;
    expense: number;
    profit: number;
}

interface BreakdownData {
    month: string;
    revenue: number;
    expense: number;
    ebidta: number;
    salaries: number;
    projectCosts: number;
    fixedCosts: number;
}

export class DashboardService {
    /**
     * Get comprehensive dashboard data
     */
    static async getDashboardData(startDate: Date, endDate: Date): Promise<{
        metrics: DashboardMetrics;
        monthlyData: MonthlyChartData[];
        breakdownData: BreakdownData[];
    }> {
        // Get revenue summary (unchanged — all revenue is valid)
        const [revenueSummary, revenueMonthly, expenseMonthly] = await Promise.all([
            RevenueService.getSummary(startDate, endDate),
            RevenueService.getMonthlyData(startDate, endDate),
            ExpenseService.getMonthlyData(startDate, endDate),
        ]);

        // Company-level expense total: exclude salary expenses that are
        // already counted as project allocations (isAllocated: true).
        // This prevents double-counting: company salary + project salary allocation.
        const companyExpenseResult = await Expense.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    isAllocated: { $ne: true },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                },
            },
        ]);
        const companyTotalExpense: number = companyExpenseResult[0]?.total ?? 0;

        let receivablesTotal = revenueSummary.totalPending;
        try {
            const receivables = await RevenueService.getReceivables();
            receivablesTotal = receivables.summary.totalOpen;
        } catch {
            receivablesTotal = revenueSummary.totalPending;
        }

        // Calculate cash in bank using append-only ledger (BankTransaction) for active accounts
        const bankAccounts = await BankAccount.find({ isActive: true });
        const activeAccountKeys = bankAccounts.map(acc => acc.accountKey).filter(Boolean);

        const ledgerResult = await BankTransaction.aggregate([
            { $match: { accountKey: { $in: activeAccountKeys } } },
            {
                $group: {
                    _id: null,
                    totalCredit: {
                        $sum: {
                            $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', 0]
                        }
                    },
                    totalDebit: {
                        $sum: {
                            $cond: [{ $eq: ['$transactionType', 'debit'] }, '$amount', 0]
                        }
                    }
                }
            }
        ]);

        const cashInBank = ledgerResult.length > 0 
            ? (ledgerResult[0].totalCredit - ledgerResult[0].totalDebit) 
            : 0;

        // GST Calculations (All-time cumulative to align with all-time cashInBank)
        const allTimeRevenueGstResult = await Revenue.aggregate([
            {
                $group: {
                    _id: null,
                    totalGST: { $sum: '$gst' },
                },
            },
        ]);
        const allTimeTotalGST = allTimeRevenueGstResult[0]?.totalGST ?? 0;

        const allTimeGstClaimableResult = await Expense.aggregate([
            {
                $match: {
                    gstClaimable: true,
                },
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            $multiply: [
                                '$amount',
                                {
                                    $divide: [
                                        { $ifNull: ['$gstRate', 18] },
                                        { $add: [100, { $ifNull: ['$gstRate', 18] }] }
                                    ]
                                }
                            ]
                        }
                    },
                },
            },
        ]);
        const allTimeGstClaimable = allTimeGstClaimableResult[0]?.total ?? 0;

        const allTimeGstPaymentsResult = await Expense.aggregate([
            {
                $match: {
                    category: { $in: ['GST Payment', 'Tax Payment'] },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                },
            },
        ]);
        const allTimeGstPayments = allTimeGstPaymentsResult[0]?.total ?? 0;

        const gstPayable = Math.max(0, allTimeTotalGST - allTimeGstClaimable - allTimeGstPayments);
        const moneyInBank = cashInBank - gstPayable;

        // Calculate EBIDTA using de-duplicated company expense total
        const ebidta = revenueSummary.totalRevenue - companyTotalExpense;

        // Calculate runway (months of operation possible with current cash)
        const avgMonthlyExpense = companyTotalExpense / Math.max(1, expenseMonthly.length);
        const runwayLeft = avgMonthlyExpense > 0 ? Math.floor(cashInBank / avgMonthlyExpense) : 0;

        // Build monthly chart data
        const monthsMap = new Map<string, MonthlyChartData>();

        // Initialize all months in the date range
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endMonthDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (currentMonthDate <= endMonthDate) {
            const monthStr = `${monthNames[currentMonthDate.getMonth() + 1]} ${currentMonthDate.getFullYear()}`;
            monthsMap.set(monthStr, {
                month: monthStr,
                revenue: 0,
                expense: 0,
                profit: 0,
            });
            currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        }

        // Add revenue data
        for (const rev of revenueMonthly) {
            const existing = monthsMap.get(rev.month) || {
                month: rev.month,
                revenue: 0,
                expense: 0,
                profit: 0,
            };
            existing.revenue = rev.revenue;
            existing.profit = rev.revenue;
            monthsMap.set(rev.month, existing);
        }

        // Add expense data
        for (const exp of expenseMonthly) {
            const existing = monthsMap.get(exp.month) || {
                month: exp.month,
                revenue: 0,
                expense: 0,
                profit: 0,
            };
            existing.expense = exp.expense;
            existing.profit = existing.revenue - exp.expense;
            monthsMap.set(exp.month, existing);
        }

        // Sort monthly data by date
        const monthlyData = Array.from(monthsMap.values()).sort((a, b) => {
            const [aMonth, aYear] = a.month.split(' ');
            const [bMonth, bYear] = b.month.split(' ');
            const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
            return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
        });

        // Build breakdown data with more details
        const breakdownData: BreakdownData[] = [];
        for (const monthData of monthlyData) {
            const expData = expenseMonthly.find((e) => e.month === monthData.month);
            breakdownData.push({
                month: monthData.month,
                revenue: monthData.revenue,
                expense: monthData.expense,
                ebidta: monthData.profit,
                salaries: expData?.salaries || 0,
                projectCosts: expData?.variable || 0,
                fixedCosts: expData?.fixed || 0,
            });
        }

        return {
            metrics: {
                totalRevenue: revenueSummary.totalRevenue,
                totalExpense: companyTotalExpense,
                ebidta,
                runwayLeft,
                cashInBank,
                receivables: receivablesTotal,
                moneyInBank,
                gstPayable,
            },
            monthlyData,
            breakdownData,
        };
    }

    /**
     * Get quick stats for dashboard widgets
     */
    static async getQuickStats(): Promise<{
        thisMonth: { revenue: number; expense: number; profit: number };
        lastMonth: { revenue: number; expense: number; profit: number };
        thisQuarter: { revenue: number; expense: number; profit: number };
        thisFY: { revenue: number; expense: number; profit: number };
    }> {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calculate date ranges
        const thisMonthStart = new Date(currentYear, currentMonth, 1);
        const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

        const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
        const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);

        // Quarter (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
        const quarterStart = new Date(currentYear, Math.floor(currentMonth / 3) * 3, 1);
        const quarterEnd = new Date(currentYear, Math.floor(currentMonth / 3) * 3 + 3, 0, 23, 59, 59);

        // Fiscal Year (Apr to Mar)
        const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
        const fyStart = new Date(fyStartYear, 3, 1); // April 1st
        const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59); // March 31st

        const getStats = async (start: Date, end: Date) => {
            // Use isAllocated-excluded total for EBIDTA/company metrics
            const [revSum, companyExpResult] = await Promise.all([
                RevenueService.getSummary(start, end),
                Expense.aggregate([
                    {
                        $match: {
                            date: { $gte: start, $lte: end },
                            isAllocated: { $ne: true },
                        },
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ]),
            ]);
            const expTotal: number = companyExpResult[0]?.total ?? 0;
            return {
                revenue: revSum.totalRevenue,
                expense: expTotal,
                profit: revSum.totalRevenue - expTotal,
            };
        };

        const [thisMonth, lastMonth, thisQuarter, thisFY] = await Promise.all([
            getStats(thisMonthStart, thisMonthEnd),
            getStats(lastMonthStart, lastMonthEnd),
            getStats(quarterStart, quarterEnd),
            getStats(fyStart, fyEnd),
        ]);

        return { thisMonth, lastMonth, thisQuarter, thisFY };
    }

    /**
     * Get top clients by revenue
     */
    static async getTopClients(
        startDate: Date,
        endDate: Date,
        limit: number = 10
    ): Promise<{ client: string; revenue: number; percentage: number }[]> {
        const result = await Revenue.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: '$client',
                    revenue: { $sum: { $ifNull: ['$amountINR', '$amount'] } },
                },
            },
            {
                $sort: { revenue: -1 },
            },
            {
                $limit: limit,
            },
        ]);

        const total = result.reduce((sum, r) => sum + r.revenue, 0);

        return result.map((r) => ({
            client: r._id,
            revenue: r.revenue,
            percentage: total > 0 ? Math.round((r.revenue / total) * 10000) / 100 : 0,
        }));
    }

    /**
     * Get expense category breakdown
     */
    static async getExpenseByCategory(
        startDate: Date,
        endDate: Date
    ): Promise<{ category: string; amount: number; percentage: number }[]> {
        const result = await Expense.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    isAllocated: { $ne: true },
                },
            },
            {
                $group: {
                    _id: '$category',
                    amount: { $sum: '$amount' },
                },
            },
            {
                $sort: { amount: -1 },
            },
        ]);

        const total = result.reduce((sum, r) => sum + r.amount, 0);

        return result.map((r) => ({
            category: r._id,
            amount: r.amount,
            percentage: total > 0 ? Math.round((r.amount / total) * 10000) / 100 : 0,
        }));
    }
}
