import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const customFieldTypeSchema = z.enum(['text', 'url', 'number', 'note', 'date', 'attachment']);

const assignmentCustomFieldSchema = z.object({
    key: z.string().min(1, 'Custom field key is required').trim(),
    label: z.string().min(1, 'Custom field name is required').trim(),
    type: customFieldTypeSchema,
    placeholder: z.string().trim().optional(),
});

const submissionFieldsSchema = z.object({
    githubLink: z.boolean().default(true),
    demoLink: z.boolean().default(true),
    videoLink: z.boolean().default(true),
    figmaLink: z.boolean().default(false),
    attachments: z.boolean().default(false),
    notes: z.boolean().default(true),
    customFields: z.array(assignmentCustomFieldSchema).default([]),
});

export const createAssignmentSchema = z.object({
    body: z.object({
        jobId: z.string().regex(objectIdRegex, 'Invalid job ID'),
        title: z.string().min(1, 'Title is required').trim(),
        description: z.string().min(1, 'Description is required').trim(),
        instructions: z.string().min(1, 'Instructions are required').trim(),
        timeLimitDays: z.number().int().positive('Time limit should be greater than 0'),
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
        timeLimitDays: z.number().int().positive().optional(),
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

const optionalUrl = z.string().trim().optional().or(z.literal(''));
const optionalCustomFieldValues = z.preprocess(
    (value) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        if (!trimmed) return {};
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    },
    z.record(z.string(), z.string().trim()).optional()
);

const optionalCustomFieldFiles = z.preprocess(
    (value) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        if (!trimmed) return {};
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    },
    z.record(z.string(), z.string().trim()).optional()
);

export const submitAssignmentSchema = z.object({
    params: z.object({
        applicationId: z.string().regex(objectIdRegex, 'Invalid application ID'),
    }),
    body: z.object({
        githubLink: optionalUrl,
        demoLink: optionalUrl,
        videoLink: optionalUrl,
        figmaLink: optionalUrl,
        notes: z.string().trim().optional().or(z.literal('')),
        customFieldValues: optionalCustomFieldValues,
        customFieldFiles: optionalCustomFieldFiles,
    }),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>['body'];
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>['body'];
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>['body'];
