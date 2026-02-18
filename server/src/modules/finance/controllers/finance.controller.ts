import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import * as expenseService from '../services/expense.service';
import * as invoiceService from '../services/invoice.service';
import * as milestoneService from '../services/milestone.service';
import * as currencyService from '../services/currency.service';
import * as projectFinanceService from '../services/project-finance.service';
import * as companyFinanceService from '../services/company-finance.service';

// ═══════════════════════════════════════════════════════════════════
// EXPENSE CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
    const expense = await expenseService.createExpense(req.body, req.user!.id);
    res.status(201).json({ success: true, data: expense });
});

export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
    const result = await expenseService.getExpenses(req.query as any);
    res.json({ success: true, data: result.expenses, pagination: result.pagination });
});

export const getExpenseById = asyncHandler(async (req: Request, res: Response) => {
    const expense = await expenseService.getExpenseById(req.params.id);
    res.json({ success: true, data: expense });
});

export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
    const expense = await expenseService.updateExpense(req.params.id, req.body);
    res.json({ success: true, data: expense });
});

export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
    await expenseService.deleteExpense(req.params.id);
    res.json({ success: true, message: 'Expense deleted' });
});

export const approveExpense = asyncHandler(async (req: Request, res: Response) => {
    const expense = await expenseService.approveExpense(req.params.id, req.user!.id);
    res.json({ success: true, data: expense });
});

export const getExpensesByCategory = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const result = await expenseService.getExpensesByCategory(
        startDate as string,
        endDate as string
    );
    res.json({ success: true, data: result });
});

// ═══════════════════════════════════════════════════════════════════
// INVOICE CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
    const invoice = await invoiceService.createInvoice(req.body, req.user!.id);
    res.status(201).json({ success: true, data: invoice });
});

export const getInvoices = asyncHandler(async (req: Request, res: Response) => {
    const result = await invoiceService.getInvoices(req.query as any);
    res.json({ success: true, data: result.invoices, pagination: result.pagination });
});

export const getInvoiceById = asyncHandler(async (req: Request, res: Response) => {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    res.json({ success: true, data: invoice });
});

export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
    const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
    res.json({ success: true, data: invoice });
});

export const deleteInvoice = asyncHandler(async (req: Request, res: Response) => {
    await invoiceService.deleteInvoice(req.params.id);
    res.json({ success: true, message: 'Invoice deleted' });
});

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
    const invoice = await invoiceService.recordPayment(req.params.id, req.body.amount);
    res.json({ success: true, data: invoice });
});

export const getOverdueInvoices = asyncHandler(async (_req: Request, res: Response) => {
    const invoices = await invoiceService.getOverdueInvoices();
    res.json({ success: true, data: invoices });
});

// ═══════════════════════════════════════════════════════════════════
// MILESTONE CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

export const createMilestone = asyncHandler(async (req: Request, res: Response) => {
    const milestone = await milestoneService.createMilestone(req.body, req.user!.id);
    res.status(201).json({ success: true, data: milestone });
});

export const getProjectMilestones = asyncHandler(async (req: Request, res: Response) => {
    const milestones = await milestoneService.getProjectMilestones(req.params.projectId);
    res.json({ success: true, data: milestones });
});

export const updateMilestone = asyncHandler(async (req: Request, res: Response) => {
    const milestone = await milestoneService.updateMilestone(req.params.id, req.body);
    res.json({ success: true, data: milestone });
});

export const completeMilestone = asyncHandler(async (req: Request, res: Response) => {
    const milestone = await milestoneService.completeMilestone(req.params.id);
    res.json({ success: true, data: milestone });
});

export const markMilestonePaid = asyncHandler(async (req: Request, res: Response) => {
    const milestone = await milestoneService.markMilestonePaid(req.params.id);
    res.json({ success: true, data: milestone });
});

export const deleteMilestone = asyncHandler(async (req: Request, res: Response) => {
    await milestoneService.deleteMilestone(req.params.id);
    res.json({ success: true, message: 'Milestone deleted' });
});

// ═══════════════════════════════════════════════════════════════════
// CURRENCY CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

export const setCurrencyRate = asyncHandler(async (req: Request, res: Response) => {
    const { fromCurrency, toCurrency, rate, date } = req.body;
    const result = await currencyService.setRate(fromCurrency, toCurrency, rate, new Date(date));
    res.json({ success: true, data: result });
});

export const getLatestRates = asyncHandler(async (req: Request, res: Response) => {
    const baseCurrency = (req.query.base as string) || 'INR';
    const rates = await currencyService.getLatestRates(baseCurrency);
    res.json({ success: true, data: rates });
});

export const convertAmount = asyncHandler(async (req: Request, res: Response) => {
    const { amount, from, to } = req.query;
    const result = await currencyService.convertAmount(
        Number(amount),
        from as string,
        to as string
    );
    res.json({ success: true, data: result });
});

// ═══════════════════════════════════════════════════════════════════
// PROJECT FINANCE CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

export const getProjectFinanceSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await projectFinanceService.getProjectFinanceSummary(req.params.projectId);
    res.json({ success: true, data: summary });
});

export const getAllProjectsFinance = asyncHandler(async (_req: Request, res: Response) => {
    const overviews = await projectFinanceService.getAllProjectsFinanceOverview();
    res.json({ success: true, data: overviews });
});

// ═══════════════════════════════════════════════════════════════════
// COMPANY FINANCE CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const stats = await companyFinanceService.getDashboardStats(
        startDate as string,
        endDate as string
    );
    res.json({ success: true, data: stats });
});

export const getMonthlyReport = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year, 10) || new Date().getFullYear();
    const report = await companyFinanceService.getMonthlyReport(year);
    res.json({ success: true, data: report });
});

export const getAccrualVsCashflow = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const result = await companyFinanceService.getAccrualVsCashflow(
        startDate as string,
        endDate as string
    );
    res.json({ success: true, data: result });
});

export const getRevenueByMonth = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year, 10) || new Date().getFullYear();
    const result = await invoiceService.getMonthlyRevenue(year);
    res.json({ success: true, data: result });
});

export const getExpensesByMonth = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year, 10) || new Date().getFullYear();
    const result = await expenseService.getMonthlyExpenses(year);
    res.json({ success: true, data: result });
});
