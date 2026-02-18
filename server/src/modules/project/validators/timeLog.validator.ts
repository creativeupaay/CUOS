import { z } from 'zod';

export const createTimeLogSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        taskId: z.string().min(1, 'Task ID is required'),
    }),
    body: z.object({
        date: z.string().or(z.date()),
        duration: z.number().positive('Duration must be positive'), // in minutes
        startTime: z.string().or(z.date()).optional(),
        endTime: z.string().or(z.date()).optional(),

        description: z.string().optional(),

        hourlyRate: z.number().positive().optional(),
        billable: z.boolean().default(true),
    }),
});

export const updateTimeLogSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'TimeLog ID is required'),
    }),
    body: z.object({
        date: z.string().or(z.date()).optional(),
        duration: z.number().positive().optional(),
        startTime: z.string().or(z.date()).optional(),
        endTime: z.string().or(z.date()).optional(),

        description: z.string().optional(),

        hourlyRate: z.number().positive().optional(),
        billable: z.boolean().optional(),
    }),
});

export const getProjectTimeLogsSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    query: z.object({
        userId: z.string().optional(),
        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        billable: z.enum(['true', 'false']).optional(),
    }).optional(),
});

export const getTaskTimeLogsSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        taskId: z.string().min(1, 'Task ID is required'),
    }),
});

export const getMyTimeLogsSchema = z.object({
    query: z.object({
        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        projectId: z.string().optional(),
    }).optional(),
});

export const deleteTimeLogSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'TimeLog ID is required'),
    }),
});
