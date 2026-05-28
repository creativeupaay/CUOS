import { Router } from 'express';
import { RevenueController } from '../controllers/revenue.controller';
import { ExpenseController } from '../controllers/expense.controller';
import { FixedExpenseController } from '../controllers/fixedExpense.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { BankTransactionController } from '../controllers/bankTransaction.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import AppError from '../../../utils/appError';
import { hasModuleAdminAccess, hasModuleViewAccess } from '../../../utils/moduleAccess.util';
import { NextFunction, Request, Response } from 'express';

const router = Router();

// All finance routes require authentication
router.use(authenticate);
router.use((req: Request, _res: Response, next: NextFunction) => {
    if (hasModuleViewAccess(req.user, 'finance')) return next();
    return next(new AppError('You do not have permission to access finance', 403));
});

const financeAdminOnly = (req: Request, _res: Response, next: NextFunction) => {
    if (hasModuleAdminAccess(req.user, 'finance')) return next();
    return next(new AppError('Finance admin access is required', 403));
};

// ── Dashboard Routes ──────────────────────────────────────────────────────
router.get('/dashboard', DashboardController.getDashboard);
router.get('/quick-stats', DashboardController.getQuickStats);
router.get('/top-clients', DashboardController.getTopClients);
router.get('/expense-breakdown', DashboardController.getExpenseByCategory);

// ── Revenue Routes ────────────────────────────────────────────────────────
router.post('/revenues', financeAdminOnly, RevenueController.create);
router.get('/revenues', RevenueController.getAll);
router.get('/receivables', RevenueController.getReceivables);
router.get('/revenues/:id', RevenueController.getById);
router.put('/revenues/:id', financeAdminOnly, RevenueController.update);
router.delete('/revenues/:id', financeAdminOnly, RevenueController.delete);
router.get('/exchange-rate', RevenueController.getExchangeRate);

// ── Expense Routes ────────────────────────────────────────────────────────
router.post('/expenses', financeAdminOnly, ExpenseController.create);
router.get('/expenses', ExpenseController.getAll);
router.get('/expenses/:id', ExpenseController.getById);
router.put('/expenses/:id', financeAdminOnly, ExpenseController.update);
router.delete('/expenses/:id', financeAdminOnly, ExpenseController.delete);

// ── Fixed Expense Routes ──────────────────────────────────────────────────
router.get('/fixed-expenses/approvals', FixedExpenseController.getApprovals);
router.get('/fixed-expenses/transactions', FixedExpenseController.getTransactions);
router.post('/fixed-expenses/approvals/:id/approve', financeAdminOnly, FixedExpenseController.approve);
router.post('/fixed-expenses/approvals/:id/reject', financeAdminOnly, FixedExpenseController.reject);
router.post('/fixed-expenses', financeAdminOnly, FixedExpenseController.create);
router.get('/fixed-expenses', FixedExpenseController.getAll);
router.put('/fixed-expenses/:id', financeAdminOnly, FixedExpenseController.update);
router.delete('/fixed-expenses/:id', financeAdminOnly, FixedExpenseController.delete);

// ── Salary Sync ───────────────────────────────────────────────────────────
router.post('/sync-salaries', financeAdminOnly, ExpenseController.syncSalaries);

// ── Project Expense Summary ───────────────────────────────────────────────
router.get('/project-expenses', ExpenseController.getProjectExpenseSummary);

// ── Cash In Bank / Bank Transactions ─────────────────────────────────────
router.get('/bank-accounts', BankTransactionController.getManagedAccounts);
router.put('/bank-accounts/:accountKey', financeAdminOnly, BankTransactionController.updateManagedAccount);
router.get('/bank-accounts/other', BankTransactionController.getOtherAccounts);
router.post('/bank-accounts/other', financeAdminOnly, BankTransactionController.createOtherAccount);
router.put('/bank-accounts/other/:id', financeAdminOnly, BankTransactionController.updateOtherAccount);
router.delete('/bank-accounts/other/:id', financeAdminOnly, BankTransactionController.deleteOtherAccount);
router.post('/bank-transactions', financeAdminOnly, BankTransactionController.create);
router.get('/bank-transactions', BankTransactionController.getAll);
router.get('/bank-transactions/:id', BankTransactionController.getById);
router.put('/bank-transactions/:id', financeAdminOnly, BankTransactionController.update);
router.delete('/bank-transactions/:id', financeAdminOnly, BankTransactionController.delete);

export default router;
