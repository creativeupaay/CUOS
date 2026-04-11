import { z } from 'zod';

export const createSalarySchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'Employee ID is required'),
        basic: z.number().min(0, 'Basic salary must be non-negative'),
        specialAllowance: z.number().min(0).default(0),
        payoutAccountKey: z.enum(['hdfc_gst', 'sbi_non_gst', 'cash']).default('hdfc_gst'),
        hra: z.number().min(0).default(0),
        da: z.number().min(0).default(0),
        deductions: z.object({
            pf: z.number().min(0).default(0),
            esi: z.number().min(0).default(0),
            tax: z.number().min(0).default(0),
            other: z.number().min(0).default(0),
        }).optional(),
        currency: z.string().default('INR'),
        effectiveFrom: z.string().min(1, 'Effective date is required'),
    }),
});

export const updateSalarySchema = z.object({
    body: z.object({
        basic: z.number().min(0).optional(),
        specialAllowance: z.number().min(0).optional(),
        payoutAccountKey: z.enum(['hdfc_gst', 'sbi_non_gst', 'cash']).optional(),
        hra: z.number().min(0).optional(),
        da: z.number().min(0).optional(),
        deductions: z.object({
            pf: z.number().min(0).optional(),
            esi: z.number().min(0).optional(),
            tax: z.number().min(0).optional(),
            other: z.number().min(0).optional(),
        }).optional(),
        effectiveFrom: z.string().optional(),
    }),
    params: z.object({ id: z.string() }),
});

export type CreateSalaryInput = z.infer<typeof createSalarySchema>['body'];
export type UpdateSalaryInput = z.infer<typeof updateSalarySchema>['body'];
