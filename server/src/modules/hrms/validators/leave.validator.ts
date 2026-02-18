import { z } from 'zod';

export const createLeaveSchema = z.object({
    body: z.object({
        type: z.enum(['casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity']),
        startDate: z.string().min(1, 'Start date is required'),
        endDate: z.string().min(1, 'End date is required'),
        days: z.number().min(0.5, 'Minimum 0.5 day leave'),
        reason: z.string().min(1, 'Reason is required'),
    }),
});

export const updateLeaveStatusSchema = z.object({
    body: z.object({
        status: z.enum(['approved', 'rejected', 'cancelled']),
        rejectionReason: z.string().optional(),
    }),
    params: z.object({ id: z.string() }),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>['body'];
export type UpdateLeaveStatusInput = z.infer<typeof updateLeaveStatusSchema>['body'];
