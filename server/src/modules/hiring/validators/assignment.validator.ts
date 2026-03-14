import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const submissionFieldsSchema = z.object({
    githubLink: z.boolean().default(true),
    demoLink: z.boolean().default(true),
    videoLink: z.boolean().default(true),
    notes: z.boolean().default(true),
});

export const createAssignmentSchema = z.object({
    body: z.object({
        jobId: z.string().regex(objectIdRegex, 'Invalid job ID'),
        title: z.string().min(1, 'Title is required').trim(),
        description: z.string().min(1, 'Description is required').trim(),
        instructions: z.string().min(1, 'Instructions are required').trim(),
        timeLimitHours: z.number().int().positive('Time limit should be greater than 0'),
        submissionFields: submissionFieldsSchema,
    }),
});

export const updateAssignmentSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid assignment ID'),
    }),
    body: z.object({
        title: z.string().min(1).trim().optional(),
        description: z.string().min(1).trim().optional(),
        instructions: z.string().min(1).trim().optional(),
        timeLimitHours: z.number().int().positive().optional(),
        submissionFields: submissionFieldsSchema.partial().optional(),
    }),
});

export const getAssignmentsByJobSchema = z.object({
    params: z.object({
        jobId: z.string().regex(objectIdRegex, 'Invalid job ID'),
    }),
});

export const assignmentIdParamSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid assignment ID'),
    }),
});

export const getAssignmentForApplicationSchema = z.object({
    params: z.object({
        applicationId: z.string().regex(objectIdRegex, 'Invalid application ID'),
    }),
});

const optionalUrl = z.string().trim().url().optional().or(z.literal(''));

export const submitAssignmentSchema = z.object({
    params: z.object({
        applicationId: z.string().regex(objectIdRegex, 'Invalid application ID'),
    }),
    body: z.object({
        githubLink: optionalUrl,
        demoLink: optionalUrl,
        videoLink: optionalUrl,
        notes: z.string().trim().optional().or(z.literal('')),
    }),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>['body'];
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>['body'];
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>['body'];
