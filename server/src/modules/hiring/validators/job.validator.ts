import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// ============================================
// JOB VALIDATORS
// ============================================
export const createJobSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Job title is required').trim(),
        department: z.string().min(1, 'Department is required').trim(),
        location: z.string().min(1, 'Location is required').trim(),
        description: z.string().min(1, 'Description is required').trim(),
        requirements: z.string().min(1, 'Requirements are required').trim(),
        employmentType: z
            .enum(['full-time', 'part-time', 'contract', 'internship'])
            .default('full-time'),
        isHiring: z.boolean().default(false),
        assignmentRequired: z.boolean().default(false),
    }),
});

export const updateJobSchema = z.object({
    body: z.object({
        title: z.string().min(1).trim().optional(),
        department: z.string().min(1).trim().optional(),
        location: z.string().min(1).trim().optional(),
        description: z.string().min(1).trim().optional(),
        requirements: z.string().min(1).trim().optional(),
        employmentType: z
            .enum(['full-time', 'part-time', 'contract', 'internship'])
            .optional(),
        isHiring: z.boolean().optional(),
        assignmentRequired: z.boolean().optional(),
    }),
});

export const getJobSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid job ID'),
    }),
});

export const listJobsSchema = z.object({
    query: z.object({
        department: z.string().optional(),
        employmentType: z
            .enum(['full-time', 'part-time', 'contract', 'internship'])
            .optional(),
        isHiring: z
            .string()
            .transform((v) => v === 'true')
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
            .default(() => 50),
    }),
});

// Inferred types
export type CreateJobInput = z.infer<typeof createJobSchema>['body'];
export type UpdateJobInput = z.infer<typeof updateJobSchema>['body'];
export type GetJobInput = z.infer<typeof getJobSchema>['params'];
export type ListJobsInput = z.infer<typeof listJobsSchema>['query'];
