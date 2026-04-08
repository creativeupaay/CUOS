import { Router } from 'express';
import { RevenueController } from '../controllers/revenue.controller';
import { ExpenseController } from '../controllers/expense.controller';
import { DashboardController } from '../controllers/dashboard.controller';
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

// ── Salary Sync ───────────────────────────────────────────────────────────
router.post('/sync-salaries', ExpenseController.syncSalaries);

// ── Project Expense Summary ───────────────────────────────────────────────
router.get('/project-expenses', ExpenseController.getProjectExpenseSummary);

export default router;
