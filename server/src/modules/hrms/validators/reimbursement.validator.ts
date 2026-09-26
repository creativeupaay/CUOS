import { z } from 'zod';

const CATEGORIES = ['travel', 'meals', 'hotel', 'fuel', 'medical', 'office', 'software', 'other'] as const;
const PAYMENT_METHODS = ['hdfc_gst', 'sbi_non_gst', 'cash'] as const;

// ── Create / Update Reimbursement ─────────────────────────────────────

export const createReimbursementSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Expense title is required').max(200),
        category: z.enum(CATEGORIES, { message: 'Invalid category' }),
        expenseDate: z.string().min(1, 'Expense date is required'),
        amount: z.number().positive('Amount must be greater than 0'),
        merchant: z.string().max(200).optional(),
        businessPurpose: z.string().max(500).optional(),
        level: z.enum(['company', 'project']).optional(),
        projectId: z.string().optional(),
    }),
});

export const updateReimbursementSchema = z.object({
    body: z.object({
        title: z.string().min(1).max(200).optional(),
        category: z.enum(CATEGORIES).optional(),
        expenseDate: z.string().optional(),
        amount: z.number().positive().optional(),
        merchant: z.string().max(200).optional(),
        businessPurpose: z.string().max(500).optional(),
        level: z.enum(['company', 'project']).optional(),
        projectId: z.string().optional(),
    }),
    params: z.object({ id: z.string() }),
});

// ── Submit (draft → pending) ──────────────────────────────────────────

export const submitReimbursementSchema = z.object({
    params: z.object({ id: z.string() }),
});

// ── Admin: Update Status ──────────────────────────────────────────────

export const updateReimbursementStatusSchema = z.object({
    body: z.object({
        status: z.enum(['approved', 'rejected', 'changes_requested', 'paid'], {
            message: 'Invalid status'
        }),
        comment: z.string().max(1000).optional(),
        paymentMethod: z.enum(PAYMENT_METHODS).optional(),
        paymentReference: z.string().max(200).optional(),
        syncToFinance: z.boolean().optional(),
    }),
    params: z.object({ id: z.string() }),
});

// ── Admin: Bulk Update Status ─────────────────────────────────────────

export const bulkUpdateReimbursementStatusSchema = z.object({
    body: z.object({
        ids: z.array(z.string()).min(1, 'At least one claim ID is required'),
        status: z.enum(['approved', 'paid'], {
            message: 'Invalid status for bulk update',
        }),
        comment: z.string().max(1000).optional(),
        paymentMethod: z.enum(PAYMENT_METHODS).optional(),
        paymentReference: z.string().max(200).optional(),
        syncToFinance: z.boolean().optional(),
    }),
});

// ── Types ─────────────────────────────────────────────────────────────

export type CreateReimbursementInput = z.infer<typeof createReimbursementSchema>['body'];
export type UpdateReimbursementInput = z.infer<typeof updateReimbursementSchema>['body'];
export type UpdateReimbursementStatusInput = z.infer<typeof updateReimbursementStatusSchema>['body'];
export type BulkUpdateReimbursementStatusInput = z.infer<typeof bulkUpdateReimbursementStatusSchema>['body'];
