import { z } from 'zod';

export const generatePayrollSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'Employee ID is required'),
        month: z.number().min(1).max(12),
        year: z.number().min(2020),
    }),
});

export const generateBulkPayrollSchema = z.object({
    body: z.object({
        month: z.coerce.number().min(1).max(12),
        year: z.coerce.number().min(2020),
    }),
});


export const updatePayrollStatusSchema = z.object({
    body: z.object({
        status: z.enum(['approved', 'paid']),
    }),
    params: z.object({ id: z.string() }),
});

export const updatePayrollSchema = z.object({
    body: z.object({
        incentiveAmount: z.number().min(0).optional(),
        penaltyAmount: z.number().min(0).optional(),
        payoutAccountKey: z.enum(['hdfc_gst', 'sbi_non_gst', 'cash']).optional(),
        deductions: z.object({
            tax: z.number().min(0).optional(),
            other: z.number().min(0).optional(),
            penalties: z.number().min(0).optional(),
        }).optional(),
    }),
    params: z.object({ id: z.string() }),
});

export const deletePayrollSchema = z.object({
    params: z.object({ id: z.string() }),
});

export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>['body'];
export type GenerateBulkPayrollInput = z.infer<typeof generateBulkPayrollSchema>['body'];
export type UpdatePayrollStatusInput = z.infer<typeof updatePayrollStatusSchema>['body'];
export type UpdatePayrollInput = z.infer<typeof updatePayrollSchema>['body'];
