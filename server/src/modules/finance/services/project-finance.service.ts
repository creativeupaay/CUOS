import { Types } from 'mongoose';
import { Project } from '../../project/models/Project.model';
import { TimeLog } from '../../project/models/TimeLog.model';
import { SalaryStructure } from '../../hrms/models/SalaryStructure.model';
import { Employee } from '../../hrms/models/Employee.model';
import { Expense } from '../models/Expense.model';
import { Invoice } from '../models/Invoice.model';
import { PaymentMilestone } from '../models/PaymentMilestone.model';
import AppError from '../../../utils/appError';

interface DeveloperCostEntry {
    userId: string;
    userName: string;
    designation: string;
    totalMinutes: number;
    totalHours: number;
    billableMinutes: number;
    billableHours: number;
    hourlyRate: number;
    totalCost: number;
}

export interface ProjectFinanceSummary {
    projectId: string;
    projectName: string;
    clientName: string;
    budget: number;
    currency: string;
    billingType: string;

    // Revenue
    totalInvoiced: number;
    totalPaid: number;
    totalPending: number;
    gstCollected: number;
    revenueWithoutGst: number;

    // Developer costs
    developerCosts: DeveloperCostEntry[];
    totalDeveloperCost: number;

    // Expenses
    directExpenses: number;
    taxExpenses: number;
    transactionFees: number;
    currencyLosses: number;
    totalExpenses: number;

    // Milestones
    milestones: {
        total: number;
        completed: number;
        paid: number;
        pending: number;
        totalAmount: number;
        completedAmount: number;
        paidAmount: number;
    };

    // Profitability
    totalCost: number;
    grossProfit: number;
    grossMargin: number;
    budgetUtilization: number;
}

/**
 * Derive hourly rate from employee's salary structure
 */
const deriveHourlyRate = (salary: any, workSchedule: any): number => {
    const gross = (salary.basic || 0) + (salary.hra || 0) + (salary.da || 0) + (salary.specialAllowance || 0);
    const monthlyHours =
        (workSchedule?.workingDaysPerWeek || 5) *
        (workSchedule?.hoursPerDay || 8) *
        4.33; // Average weeks per month
    return monthlyHours > 0 ? Math.round((gross / monthlyHours) * 100) / 100 : 0;
};

/**
 * Get full financial summary for a project
 */
export const getProjectFinanceSummary = async (
    projectId: string
): Promise<ProjectFinanceSummary> => {
    const project = await Project.findById(projectId)
        .populate('clientId', 'name companyName');

    if (!project) throw new AppError('Project not found', 404);

    // ─── Developer Costs (TimeLog × derived hourly rate) ────────────
    const timeLogs = await TimeLog.find({ projectId })
        .populate('userId', 'name');

    // Get all unique user IDs from time logs
    const userIds = [...new Set(timeLogs.map((t) => t.userId._id?.toString() || t.userId.toString()))];

    // Lookup employee records and salary structures for these users
    const employees = await Employee.find({ userId: { $in: userIds } })
        .select('userId designation workSchedule');

    const employeeMap = new Map(employees.map((e) => [e.userId.toString(), e]));

    const salaryStructures = await SalaryStructure.find({
        employeeId: { $in: employees.map((e) => e._id) },
    });
    const salaryMap = new Map(
        salaryStructures.map((s) => [s.employeeId.toString(), s])
    );

    // Aggregate by user
    const userCosts = new Map<string, DeveloperCostEntry>();

    for (const log of timeLogs) {
        const userId = log.userId._id?.toString() || log.userId.toString();
        const userName = (log.userId as any).name || 'Unknown';
        const employee = employeeMap.get(userId);
        const salary = employee ? salaryMap.get(employee._id.toString()) : null;
        const hourlyRate = salary
            ? deriveHourlyRate(salary, employee?.workSchedule)
            : log.hourlyRate || project.hourlyRate || 0;

        if (userCosts.has(userId)) {
            const entry = userCosts.get(userId)!;
            entry.totalMinutes += log.duration;
            if (log.billable) entry.billableMinutes += log.duration;
            entry.totalCost += (log.duration / 60) * hourlyRate;
        } else {
            userCosts.set(userId, {
                userId,
                userName,
                designation: employee?.designation || 'N/A',
                totalMinutes: log.duration,
                totalHours: 0,
                billableMinutes: log.billable ? log.duration : 0,
                billableHours: 0,
                hourlyRate,
                totalCost: (log.duration / 60) * hourlyRate,
            });
        }
    }

    const developerCosts: DeveloperCostEntry[] = Array.from(userCosts.values()).map((d) => ({
        ...d,
        totalHours: Math.round((d.totalMinutes / 60) * 100) / 100,
        billableHours: Math.round((d.billableMinutes / 60) * 100) / 100,
        totalCost: Math.round(d.totalCost * 100) / 100,
    }));

    const totalDeveloperCost = developerCosts.reduce((sum, d) => sum + d.totalCost, 0);

    // ─── Invoices ──────────────────────────────────────────────────
    const invoices = await Invoice.find({
        projectId,
        status: { $in: ['sent', 'partial', 'paid'] },
    });

    const totalInvoiced = invoices.reduce((s, i) => s + i.amountInBaseCurrency, 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const totalPending = totalInvoiced - totalPaid;
    const gstCollected = invoices.reduce((s, i) => s + i.gstAmount, 0);
    const revenueWithoutGst = invoices.reduce((s, i) => s + i.subtotal, 0);

    // ─── Direct Expenses ───────────────────────────────────────────
    const expenses = await Expense.find({
        projectId,
        status: { $in: ['approved', 'paid'] },
    });

    let directExpenses = 0;
    let taxExpenses = 0;
    let transactionFees = 0;
    let currencyLosses = 0;

    for (const exp of expenses) {
        switch (exp.category) {
            case 'tax':
                taxExpenses += exp.amountInBaseCurrency;
                break;
            case 'transaction-fee':
                transactionFees += exp.amountInBaseCurrency;
                break;
            case 'currency-loss':
                currencyLosses += exp.amountInBaseCurrency;
                break;
            default:
                directExpenses += exp.amountInBaseCurrency;
        }
    }

    const totalExpenses = directExpenses + taxExpenses + transactionFees + currencyLosses;

    // ─── Milestones ────────────────────────────────────────────────
    const milestonesList = await PaymentMilestone.find({ projectId });
    const milestoneStats = {
        total: milestonesList.length,
        completed: milestonesList.filter((m) => ['completed', 'invoiced', 'paid'].includes(m.status)).length,
        paid: milestonesList.filter((m) => m.status === 'paid').length,
        pending: milestonesList.filter((m) => m.status === 'pending').length,
        totalAmount: milestonesList.reduce((s, m) => s + m.amountInBaseCurrency, 0),
        completedAmount: milestonesList
            .filter((m) => ['completed', 'invoiced', 'paid'].includes(m.status))
            .reduce((s, m) => s + m.amountInBaseCurrency, 0),
        paidAmount: milestonesList
            .filter((m) => m.status === 'paid')
            .reduce((s, m) => s + m.amountInBaseCurrency, 0),
    };

    // ─── Profitability ─────────────────────────────────────────────
    const totalCost = totalDeveloperCost + totalExpenses;
    const grossProfit = revenueWithoutGst - totalCost;
    const grossMargin = revenueWithoutGst > 0 ? (grossProfit / revenueWithoutGst) * 100 : 0;
    const budgetUtilization = project.budget ? (totalCost / project.budget) * 100 : 0;

    return {
        projectId: project._id.toString(),
        projectName: project.name,
        clientName: (project.clientId as any)?.companyName || (project.clientId as any)?.name || 'N/A',
        budget: project.budget || 0,
        currency: project.currency,
        billingType: project.billingType,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        gstCollected: Math.round(gstCollected * 100) / 100,
        revenueWithoutGst: Math.round(revenueWithoutGst * 100) / 100,
        developerCosts,
        totalDeveloperCost: Math.round(totalDeveloperCost * 100) / 100,
        directExpenses: Math.round(directExpenses * 100) / 100,
        taxExpenses: Math.round(taxExpenses * 100) / 100,
        transactionFees: Math.round(transactionFees * 100) / 100,
        currencyLosses: Math.round(currencyLosses * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        milestones: milestoneStats,
        totalCost: Math.round(totalCost * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossMargin: Math.round(grossMargin * 100) / 100,
        budgetUtilization: Math.round(budgetUtilization * 100) / 100,
    };
};

/**
 * Get financial overview for all projects
 */
export const getAllProjectsFinanceOverview = async () => {
    const projects = await Project.find({ isArchived: false })
        .populate('clientId', 'name companyName')
        .select('name clientId budget currency billingType status')
        .sort({ createdAt: -1 });

    const overviews = [];

    for (const project of projects) {
        // Quick aggregation per project
        const [invoiceAgg] = await Invoice.aggregate([
            {
                $match: {
                    projectId: project._id,
                    status: { $in: ['sent', 'partial', 'paid'] },
                },
            },
            {
                $group: {
                    _id: null,
                    totalInvoiced: { $sum: '$amountInBaseCurrency' },
                    totalPaid: { $sum: '$paidAmount' },
                },
            },
        ]);

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

        overviews.push({
            projectId: project._id.toString(),
            projectName: project.name,
            clientName: (project.clientId as any)?.companyName || (project.clientId as any)?.name || 'N/A',
            budget: project.budget || 0,
            currency: project.currency,
            status: project.status,
            totalInvoiced: invoiceAgg?.totalInvoiced || 0,
            totalPaid: invoiceAgg?.totalPaid || 0,
            totalExpenses: expenseAgg?.totalExpenses || 0,
            profit: (invoiceAgg?.totalPaid || 0) - (expenseAgg?.totalExpenses || 0),
        });
    }

    return overviews;
};
