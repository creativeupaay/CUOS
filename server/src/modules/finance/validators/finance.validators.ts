import { z } from 'zod';

// ── Expense Validators ──────────────────────────────────────────────
export const createExpenseSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        amount: z.number().min(0),
        currency: z.string().default('INR'),
        exchangeRate: z.number().min(0).default(1),
        category: z.enum([
            'salary', 'fixed', 'cac', 'project', 'overhead',
            'tax', 'transaction-fee', 'currency-loss',
        ]),
        projectId: z.string().optional(),
        employeeId: z.string().optional(),
        date: z.string().min(1, 'Date is required'),
        recurring: z.boolean().default(false),
        recurringFrequency: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
        gstApplicable: z.boolean().default(false),
        gstAmount: z.number().min(0).default(0),
        tdsApplicable: z.boolean().default(false),
        tdsAmount: z.number().min(0).default(0),
        notes: z.string().optional(),
    }),
});

export const updateExpenseSchema = z.object({
    body: z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        amount: z.number().min(0).optional(),
        currency: z.string().optional(),
        exchangeRate: z.number().min(0).optional(),
        category: z.enum([
            'salary', 'fixed', 'cac', 'project', 'overhead',
            'tax', 'transaction-fee', 'currency-loss',
        ]).optional(),
        projectId: z.string().optional(),
        employeeId: z.string().optional(),
        date: z.string().optional(),
        recurring: z.boolean().optional(),
        gstApplicable: z.boolean().optional(),
        gstAmount: z.number().min(0).optional(),
        tdsApplicable: z.boolean().optional(),
        tdsAmount: z.number().min(0).optional(),
        status: z.enum(['pending', 'approved', 'paid', 'rejected']).optional(),
        notes: z.string().optional(),
    }),
});

// ── Invoice Validators ──────────────────────────────────────────────
export const createInvoiceSchema = z.object({
    body: z.object({
        projectId: z.string().min(1, 'Project is required'),
        clientId: z.string().min(1, 'Client is required'),
        items: z.array(z.object({
            description: z.string().min(1),
            quantity: z.number().min(1),
            rate: z.number().min(0),
        })).min(1, 'At least one item is required'),
        gstRate: z.number().min(0).default(18),
        tdsRate: z.number().min(0).default(0),
        currency: z.string().default('INR'),
        exchangeRate: z.number().min(0).default(1),
        issueDate: z.string().min(1, 'Issue date is required'),
        dueDate: z.string().min(1, 'Due date is required'),
        notes: z.string().optional(),
    }),
});

export const updateInvoiceSchema = z.object({
    body: z.object({
        items: z.array(z.object({
            description: z.string().min(1),
            quantity: z.number().min(1),
            rate: z.number().min(0),
        })).optional(),
        gstRate: z.number().min(0).optional(),
        tdsRate: z.number().min(0).optional(),
        currency: z.string().optional(),
        exchangeRate: z.number().min(0).optional(),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
    }),
});

export const recordPaymentSchema = z.object({
    body: z.object({
        amount: z.number().min(0.01, 'Payment amount must be positive'),
    }),
});

// ── Milestone Validators ────────────────────────────────────────────
export const createMilestoneSchema = z.object({
    body: z.object({
        projectId: z.string().min(1, 'Project is required'),
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        amount: z.number().min(0),
        currency: z.string().default('INR'),
        exchangeRate: z.number().min(0).default(1),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
    }),
});

export const updateMilestoneSchema = z.object({
    body: z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        amount: z.number().min(0).optional(),
        currency: z.string().optional(),
        exchangeRate: z.number().min(0).optional(),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
    }),
});

// ── Currency Rate Validator ─────────────────────────────────────────
export const setCurrencyRateSchema = z.object({
    body: z.object({
        fromCurrency: z.string().min(1),
        toCurrency: z.string().min(1),
        rate: z.number().min(0),
        date: z.string().min(1),
    }),
});
