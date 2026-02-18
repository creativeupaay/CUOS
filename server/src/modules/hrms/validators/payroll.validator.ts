import { z } from 'zod';

export const generatePayrollSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'Employee ID is required'),
        month: z.number().min(1).max(12),
        year: z.number().min(2020),
    }),
});

export const updatePayrollStatusSchema = z.object({
    body: z.object({
        status: z.enum(['approved', 'paid']),
    }),
    params: z.object({ id: z.string() }),
});

export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>['body'];
export type UpdatePayrollStatusInput = z.infer<typeof updatePayrollStatusSchema>['body'];
