import { z } from 'zod';

export const checkInSchema = z.object({
    body: z.object({
        projectId: z.string().optional(),
        taskId: z.string().optional(),
        notes: z.string().optional(),
    }),
});

export const checkOutSchema = z.object({
    body: z.object({
        notes: z.string().optional(),
    }),
});

export const getAttendanceSchema = z.object({
    query: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        employeeId: z.string().optional(),
    }),
});
