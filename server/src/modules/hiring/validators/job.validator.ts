import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const hhmmRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const interviewDailySlotSchema = z
    .object({
        startTime: z.string().regex(hhmmRegex, 'Invalid time format. Use HH:mm'),
        endTime: z.string().regex(hhmmRegex, 'Invalid time format. Use HH:mm'),
    })
    .refine((value) => value.endTime > value.startTime, {
        message: 'endTime must be later than startTime',
        path: ['endTime'],
    });

const interviewAvailabilityRangeSchema = z
    .object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
    })
    .refine((value) => value.startDate <= value.endDate, {
        message: 'endDate must be later than or equal to startDate',
        path: ['endDate'],
    });

const interviewDateOverrideSchema = z.object({
    date: z.string().datetime(),
    slots: z.array(interviewDailySlotSchema).min(1),
});

const reminderMinutesSchema = z.preprocess(
    (value) => {
        if (value === undefined || value === null) {
            return undefined;
        }
        if (Array.isArray(value)) {
            return value;
        }
        return [value];
    },
    z.array(z.number().int().min(0).max(10080)).min(1)
);

const interviewSchedulingSchema = z
    .object({
        enabled: z.boolean().default(false),
        active: z.boolean().default(false),
        timezone: z.string().min(1).default('Asia/Kolkata'),
        organizerName: z.string().min(1).default('HR Team'),
        availableRanges: z.array(interviewAvailabilityRangeSchema).default([]),
        dateOverrides: z.array(interviewDateOverrideSchema).default([]),
        weekdays: z
            .array(z.number().int().min(0).max(6))
            .min(1, 'Select at least one weekday')
            .default([1, 2, 3, 4, 5]),
        dailySlots: z.array(interviewDailySlotSchema).min(1).default([
            {
                startTime: '10:00',
                endTime: '18:00',
            },
        ]),
        durationMinutes: z.number().int().min(10).max(240).default(45),
        beforeEventBufferMinutes: z.number().int().min(0).max(120).default(5),
        afterEventBufferMinutes: z.number().int().min(0).max(120).default(5),
        reminderMinutesBefore: reminderMinutesSchema.default([30]),
    });

const interviewSchedulingUpdateSchema = z
    .object({
        enabled: z.boolean().optional(),
        active: z.boolean().optional(),
        timezone: z.string().min(1).optional(),
        organizerName: z.string().min(1).optional(),
        availableRanges: z.array(interviewAvailabilityRangeSchema).optional(),
        dateOverrides: z.array(interviewDateOverrideSchema).optional(),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
        dailySlots: z.array(interviewDailySlotSchema).min(1).optional(),
        durationMinutes: z.number().int().min(10).max(240).optional(),
        beforeEventBufferMinutes: z.number().int().min(0).max(120).optional(),
        afterEventBufferMinutes: z.number().int().min(0).max(120).optional(),
        reminderMinutesBefore: reminderMinutesSchema.optional(),
    });

// ============================================
// JOB VALIDATORS
// ============================================
export const createJobSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Job title is required').trim(),
        department: z.string().min(1, 'Department is required').trim(),
        locationType: z.enum(['Remote', 'In-Office']).default('In-Office'),
        location: z.string().trim().optional(),
        description: z.string().min(1, 'Description is required').trim(),
        requirements: z.string().min(1, 'Requirements are required').trim(),
        employmentType: z
            .enum(['full-time', 'part-time', 'contract', 'internship'])
            .default('full-time'),
        isHiring: z.boolean().default(false),
        assignmentRequired: z.boolean().default(false),
        interviewScheduling: interviewSchedulingSchema.optional(),
    }),
});

export const updateJobSchema = z.object({
    body: z.object({
        title: z.string().min(1).trim().optional(),
        department: z.string().min(1).trim().optional(),
        locationType: z.enum(['Remote', 'In-Office']).optional(),
        location: z.string().trim().optional(),
        description: z.string().min(1).trim().optional(),
        requirements: z.string().min(1).trim().optional(),
        employmentType: z
            .enum(['full-time', 'part-time', 'contract', 'internship'])
            .optional(),
        isHiring: z.boolean().optional(),
        assignmentRequired: z.boolean().optional(),
        interviewScheduling: interviewSchedulingUpdateSchema.optional(),
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
export type InterviewSchedulingInput = NonNullable<CreateJobInput['interviewScheduling']>;
export type InterviewSchedulingUpdateInput = NonNullable<UpdateJobInput['interviewScheduling']>;

// ============================================
// JOB TEMPLATE VALIDATORS
// ============================================
export const createJobTemplateSchema = z.object({
    body: z.object({
        templateName: z.string().min(1, 'Template name is required').trim(),
        title: z.string().trim().optional(),
        department: z.string().trim().optional(),
        locationType: z.enum(['Remote', 'In-Office']).default('In-Office'),
        location: z.string().trim().optional(),
        description: z.string().trim().optional(),
        requirements: z.string().trim().optional(),
        employmentType: z
            .enum(['full-time', 'part-time', 'contract', 'internship'])
            .default('full-time'),
    }),
});

export const updateJobTemplateSchema = z.object({
    body: z.object({
        templateName: z.string().min(1).trim().optional(),
        title: z.string().min(1).trim().optional(),
        department: z.string().min(1).trim().optional(),
        locationType: z.enum(['Remote', 'In-Office']).optional(),
        location: z.string().trim().optional(),
        description: z.string().min(1).trim().optional(),
        requirements: z.string().min(1).trim().optional(),
        employmentType: z
            .enum(['full-time', 'part-time', 'contract', 'internship'])
            .optional(),
    }),
});

export const getJobTemplateSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid template ID'),
    }),
});

export type CreateJobTemplateInput = z.infer<typeof createJobTemplateSchema>['body'];
export type UpdateJobTemplateInput = z.infer<typeof updateJobTemplateSchema>['body'];
