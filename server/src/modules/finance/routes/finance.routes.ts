import { Router } from 'express';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { isAdmin } from '../../auth/middlewares/authorize.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';

// Controller
import * as fc from '../controllers/finance.controller';

// Validators
import {
    createExpenseSchema,
    updateExpenseSchema,
    createInvoiceSchema,
    updateInvoiceSchema,
    recordPaymentSchema,
    createMilestoneSchema,
    updateMilestoneSchema,
    setCurrencyRateSchema,
} from '../validators/finance.validators';

const router = Router();

// All finance routes require authentication
router.use(authenticate);

// ══════════════════════════════════════════════════════════════════════
// COMPANY DASHBOARD & REPORTS
// ══════════════════════════════════════════════════════════════════════
router.get('/dashboard', isAdmin, fc.getDashboardStats);
router.get('/reports/monthly/:year', isAdmin, fc.getMonthlyReport);
router.get('/reports/accrual-vs-cash', isAdmin, fc.getAccrualVsCashflow);
router.get('/reports/revenue/:year', isAdmin, fc.getRevenueByMonth);
router.get('/reports/expenses/:year', isAdmin, fc.getExpensesByMonth);

// ══════════════════════════════════════════════════════════════════════
// PROJECT FINANCE
// ══════════════════════════════════════════════════════════════════════
router.get('/projects', isAdmin, fc.getAllProjectsFinance);
router.get('/projects/:projectId', isAdmin, fc.getProjectFinanceSummary);

// ══════════════════════════════════════════════════════════════════════
// EXPENSES
// ══════════════════════════════════════════════════════════════════════
router.get('/expenses', isAdmin, fc.getExpenses);
router.get('/expenses/by-category', isAdmin, fc.getExpensesByCategory);
router.get('/expenses/:id', isAdmin, fc.getExpenseById);
router.post('/expenses', isAdmin, validateRequest(createExpenseSchema), fc.createExpense);
router.patch('/expenses/:id', isAdmin, validateRequest(updateExpenseSchema), fc.updateExpense);
router.delete('/expenses/:id', isAdmin, fc.deleteExpense);
router.patch('/expenses/:id/approve', isAdmin, fc.approveExpense);

// ══════════════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════════════
router.get('/invoices', isAdmin, fc.getInvoices);
router.get('/invoices/overdue', isAdmin, fc.getOverdueInvoices);
router.get('/invoices/:id', isAdmin, fc.getInvoiceById);
router.post('/invoices', isAdmin, validateRequest(createInvoiceSchema), fc.createInvoice);
router.patch('/invoices/:id', isAdmin, validateRequest(updateInvoiceSchema), fc.updateInvoice);
router.delete('/invoices/:id', isAdmin, fc.deleteInvoice);
router.post(
    '/invoices/:id/payment',
    isAdmin,
    validateRequest(recordPaymentSchema),
    fc.recordPayment
);

// ══════════════════════════════════════════════════════════════════════
// PAYMENT MILESTONES
// ══════════════════════════════════════════════════════════════════════
router.get('/milestones/:projectId', isAdmin, fc.getProjectMilestones);
router.post('/milestones', isAdmin, validateRequest(createMilestoneSchema), fc.createMilestone);
router.patch(
    '/milestones/:id',
    isAdmin,
    validateRequest(updateMilestoneSchema),
    fc.updateMilestone
);
router.patch('/milestones/:id/complete', isAdmin, fc.completeMilestone);
router.patch('/milestones/:id/paid', isAdmin, fc.markMilestonePaid);
router.delete('/milestones/:id', isAdmin, fc.deleteMilestone);

// ══════════════════════════════════════════════════════════════════════
// CURRENCY RATES
// ══════════════════════════════════════════════════════════════════════
router.get('/currency/rates', isAdmin, fc.getLatestRates);
router.get('/currency/convert', isAdmin, fc.convertAmount);
router.post(
    '/currency/rates',
    isAdmin,
    validateRequest(setCurrencyRateSchema),
    fc.setCurrencyRate
);

export default router;
