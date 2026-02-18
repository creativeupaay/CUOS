import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// ============================================
// LINE ITEM SCHEMA
// ============================================
const lineItemSchema = z.object({
    description: z.string().min(1, 'Description is required').trim(),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    unitPrice: z.number().min(0, 'Unit price must be >= 0'),
    total: z.number().min(0).optional(), // Auto-computed on save
});

// ============================================
// PROPOSAL VALIDATORS
// ============================================
export const createProposalSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required').trim(),
        leadId: z.string().regex(objectIdRegex, 'Invalid lead ID'),
        clientId: z.string().regex(objectIdRegex, 'Invalid client ID').optional(),
        validUntil: z.string().optional(),
        items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
        tax: z.number().min(0).default(0),
        currency: z.string().default('INR'),
        notes: z.string().optional(),
    }),
});

export const updateProposalSchema = z.object({
    body: z.object({
        title: z.string().min(1).trim().optional(),
        validUntil: z.string().optional().nullable(),
        items: z.array(lineItemSchema).min(1).optional(),
        tax: z.number().min(0).optional(),
        currency: z.string().optional(),
        notes: z.string().optional(),
    }),
});

export const getProposalSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid proposal ID'),
    }),
});

export const listProposalsSchema = z.object({
    query: z.object({
        leadId: z.string().regex(objectIdRegex).optional(),
        status: z
            .enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'])
            .optional(),
        search: z.string().optional(),
        page: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .default(() => 1),
        limit: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .default(() => 20),
    }),
});

export const updateStatusSchema = z.object({
    body: z.object({
        status: z.enum(['sent', 'viewed', 'accepted', 'rejected', 'expired']),
    }),
});

// Inferred types
export type CreateProposalInput = z.infer<typeof createProposalSchema>['body'];
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>['body'];
export type GetProposalInput = z.infer<typeof getProposalSchema>['params'];
export type ListProposalsInput = z.infer<typeof listProposalsSchema>['query'];
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>['body'];
