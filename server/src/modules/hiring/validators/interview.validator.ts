import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const interviewApplicationParamSchema = z.object({
    params: z.object({
        applicationId: z.string().regex(objectIdRegex, 'Invalid application ID'),
    }),
});

export const interviewIdParamSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid interview ID'),
    }),
});

export const calcomWebhookSchema = z.object({
    body: z.record(z.string(), z.any()),
});

export const webhookDebugQuerySchema = z.object({
    query: z.object({
        limit: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .optional(),
    }),
});

export const webhookDebugPublicQuerySchema = z.object({
    query: z.object({
        key: z.string().trim().min(1, 'Debug key is required'),
        limit: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .optional(),
    }),
});

export const listInterviewsSchema = z.object({
    query: z.object({
        applicationId: z.string().regex(objectIdRegex, 'Invalid application ID').optional(),
        status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled', 'no-show']).optional(),
        search: z.string().trim().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        page: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .default(() => 1),
        limit: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .default(() => 50),
    }),
});

export const updateInterviewStatusSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid interview ID'),
    }),
    body: z.object({
        status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled', 'no-show']),
    }),
});

export const saveInterviewNoteSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid interview ID'),
    }),
    body: z.object({
        rating: z.number().min(1).max(10),
        technicalScore: z.number().min(1).max(10),
        communicationScore: z.number().min(1).max(10),
        notes: z.string().trim().min(1, 'Notes are required'),
    }),
});

export type ListInterviewsInput = z.infer<typeof listInterviewsSchema>['query'];
export type WebhookDebugQueryInput = z.infer<typeof webhookDebugQuerySchema>['query'];
export type WebhookDebugPublicQueryInput = z.infer<typeof webhookDebugPublicQuerySchema>['query'];
export type UpdateInterviewStatusInput = z.infer<typeof updateInterviewStatusSchema>['body'];
export type SaveInterviewNoteInput = z.infer<typeof saveInterviewNoteSchema>['body'];
