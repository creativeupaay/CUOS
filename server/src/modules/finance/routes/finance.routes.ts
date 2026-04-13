import { Router } from 'express';
import { RevenueController } from '../controllers/revenue.controller';
import { ExpenseController } from '../controllers/expense.controller';
import { FixedExpenseController } from '../controllers/fixedExpense.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { BankTransactionController } from '../controllers/bankTransaction.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';

const router = Router();

// All finance routes require authentication
router.use(authenticate);

// ── Dashboard Routes ──────────────────────────────────────────────────────
router.get('/dashboard', DashboardController.getDashboard);
router.get('/quick-stats', DashboardController.getQuickStats);
router.get('/top-clients', DashboardController.getTopClients);
router.get('/expense-breakdown', DashboardController.getExpenseByCategory);

// ── Revenue Routes ────────────────────────────────────────────────────────
router.post('/revenues', RevenueController.create);
router.get('/revenues', RevenueController.getAll);
router.get('/revenues/:id', RevenueController.getById);
router.put('/revenues/:id', RevenueController.update);
router.delete('/revenues/:id', RevenueController.delete);

// ── Expense Routes ────────────────────────────────────────────────────────
router.post('/expenses', ExpenseController.create);
router.get('/expenses', ExpenseController.getAll);
router.get('/expenses/:id', ExpenseController.getById);
router.put('/expenses/:id', ExpenseController.update);
router.delete('/expenses/:id', ExpenseController.delete);

// ── Fixed Expense Routes ──────────────────────────────────────────────────
router.get('/fixed-expenses/approvals', FixedExpenseController.getApprovals);
router.get('/fixed-expenses/transactions', FixedExpenseController.getTransactions);
router.post('/fixed-expenses/approvals/:id/approve', FixedExpenseController.approve);
router.post('/fixed-expenses/approvals/:id/reject', FixedExpenseController.reject);
router.post('/fixed-expenses', FixedExpenseController.create);
router.get('/fixed-expenses', FixedExpenseController.getAll);
router.put('/fixed-expenses/:id', FixedExpenseController.update);
router.delete('/fixed-expenses/:id', FixedExpenseController.delete);

// ── Salary Sync ───────────────────────────────────────────────────────────
router.post('/sync-salaries', ExpenseController.syncSalaries);

// ── Project Expense Summary ───────────────────────────────────────────────
router.get('/project-expenses', ExpenseController.getProjectExpenseSummary);

// ── Cash In Bank / Bank Transactions ─────────────────────────────────────
router.get('/bank-accounts', BankTransactionController.getManagedAccounts);
router.put('/bank-accounts/:accountKey', BankTransactionController.updateManagedAccount);
router.get('/bank-accounts/other', BankTransactionController.getOtherAccounts);
router.post('/bank-accounts/other', BankTransactionController.createOtherAccount);
router.put('/bank-accounts/other/:id', BankTransactionController.updateOtherAccount);
router.delete('/bank-accounts/other/:id', BankTransactionController.deleteOtherAccount);
router.post('/bank-transactions', BankTransactionController.create);
router.get('/bank-transactions', BankTransactionController.getAll);
router.get('/bank-transactions/:id', BankTransactionController.getById);
router.put('/bank-transactions/:id', BankTransactionController.update);
router.delete('/bank-transactions/:id', BankTransactionController.delete);

export default router;
