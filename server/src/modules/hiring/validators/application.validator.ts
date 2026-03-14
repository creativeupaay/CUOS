import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const applicationStatusSchema = z.enum([
    'new',
    'screening',
    'shortlisted',
    'assignment-round',
    'interview',
    'rejected',
    'offered',
    'hired',
]);

export const createPublicApplicationSchema = z.object({
    params: z.object({
        jobId: z.string().regex(objectIdRegex, 'Invalid job ID'),
    }),
    body: z.object({
        name: z.string().min(1, 'Name is required').trim(),
        email: z.string().email('Valid email is required').trim().toLowerCase(),
        phone: z.string().min(1, 'Phone is required').trim(),
        portfolio: z.string().trim().optional().or(z.literal('')),
        linkedin: z.string().trim().optional().or(z.literal('')),
        experience: z.string().trim().optional().or(z.literal('')),
        coverLetter: z.string().trim().optional().or(z.literal('')),
    }),
});

export const listApplicationsSchema = z.object({
    query: z.object({
        jobId: z.string().regex(objectIdRegex, 'Invalid job ID').optional(),
        status: applicationStatusSchema.optional(),
        tags: z.string().optional(),
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
            .default(() => 50),
    }),
});

export const getApplicationSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid application ID'),
    }),
});

export const updateApplicationSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid application ID'),
    }),
    body: z.object({
        status: applicationStatusSchema.optional(),
        tags: z.array(z.string().trim().toLowerCase()).optional(),
    }),
});

export const updateStatusSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid application ID'),
    }),
    body: z.object({
        status: applicationStatusSchema,
    }),
});

export const tagSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid application ID'),
    }),
    body: z.object({
        tag: z.string().min(1, 'Tag is required').trim().toLowerCase(),
    }),
});

export const applicationDecisionSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid application ID'),
    }),
    body: z.object({
        decision: z.enum(['rejected', 'accepted']),
        salary: z.string().trim().optional().or(z.literal('')),
        position: z.string().trim().optional().or(z.literal('')),
    }),
});

export type CreatePublicApplicationInput = z.infer<typeof createPublicApplicationSchema>['body'];
export type ListApplicationsInput = z.infer<typeof listApplicationsSchema>['query'];
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>['body'];
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>['body'];
export type TagInput = z.infer<typeof tagSchema>['body'];
export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>['body'];
