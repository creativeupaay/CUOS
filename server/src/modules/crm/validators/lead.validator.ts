import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// ============================================
// LEAD VALIDATORS
// ============================================
export const createLeadSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name is required').trim(),
        email: z.string().email('Invalid email').trim(),
        phone: z.string().optional(),
        company: z.string().optional(),
        source: z
            .enum(['website', 'referral', 'cold-call', 'social-media', 'event', 'other'])
            .default('other'),
        stage: z
            .enum(['new', 'contacted', 'qualified', 'proposal-sent', 'negotiation', 'closed', 'pending', 'lead-lost', 'follow-up'])
            .default('new'),
        priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        estimatedValue: z.number().min(0).optional(),
        currency: z.string().default('INR'),
        notes: z.string().optional(),
        tags: z.array(z.string()).default([]),
        assignedTo: z
            .string()
            .regex(objectIdRegex, 'Invalid user ID')
            .optional(),
        expectedCloseDate: z.string().datetime().optional().or(z.string().optional()),
    }),
});

export const updateLeadSchema = z.object({
    body: z.object({
        name: z.string().min(1).trim().optional(),
        email: z.string().email().trim().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        source: z
            .enum(['website', 'referral', 'cold-call', 'social-media', 'event', 'other'])
            .optional(),
        stage: z
            .enum(['new', 'contacted', 'qualified', 'proposal-sent', 'negotiation', 'closed', 'pending', 'lead-lost', 'follow-up'])
            .optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        estimatedValue: z.number().min(0).optional(),
        currency: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        assignedTo: z
            .string()
            .regex(objectIdRegex, 'Invalid user ID')
            .optional()
            .nullable(),
        lostReason: z.string().optional(),
        expectedCloseDate: z.string().optional().nullable(),
    }),
});

export const getLeadSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid lead ID'),
    }),
});

export const listLeadsSchema = z.object({
    query: z.object({
        stage: z
            .enum(['new', 'contacted', 'qualified', 'proposal-sent', 'negotiation', 'closed', 'pending', 'lead-lost', 'follow-up'])
            .optional(),
        source: z
            .enum(['website', 'referral', 'cold-call', 'social-media', 'event', 'other'])
            .optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assignedTo: z.string().regex(objectIdRegex).optional(),
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

export const addActivitySchema = z.object({
    body: z.object({
        type: z.enum(['call', 'email', 'meeting', 'note']),
        description: z.string().min(1, 'Description is required').trim(),
        date: z.string().optional(),
    }),
});

export const addMeetingSchema = z.object({
    body: z.object({
        type: z.enum(['internal', 'external']),
        title: z.string().min(1, 'Title is required').trim(),
        notes: z.string().default(''),
        date: z.string().optional(),
    }),
});

// Inferred types
export type CreateLeadInput = z.infer<typeof createLeadSchema>['body'];
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>['body'];
export type GetLeadInput = z.infer<typeof getLeadSchema>['params'];
export type ListLeadsInput = z.infer<typeof listLeadsSchema>['query'];
export type AddActivityInput = z.infer<typeof addActivitySchema>['body'];
export type AddMeetingInput = z.infer<typeof addMeetingSchema>['body'];
