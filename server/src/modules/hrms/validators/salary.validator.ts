import { z } from 'zod';

const monthlyEntrySchema = z.object({
    month: z.number().min(1).max(12),
    year: z.number().min(2000),
    amount: z.number().min(0),
    paymentDate: z.string().min(1),
});

const additionalCompensationSchema = z.object({
    name: z.string().min(1),
    amount: z.number().min(0),
    redeemableOn: z.string().min(1),
    isVariable: z.boolean().default(true),
});

export const createSalarySchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'Employee ID is required'),
        salaryType: z.enum(['yearly', 'monthly']).default('yearly'),
        compensationType: z.enum(['salary', 'stipend', 'contract']).default('salary'),
        // Yearly fields
        basic: z.number().min(0, 'Basic salary must be non-negative').default(0),
        specialAllowance: z.number().min(0).default(0),
        annualAmount: z.number().min(0).default(0),
        effectiveFrom: z.string().optional(),
        firstSalaryDate: z.string().optional(),
        // Monthly fields
        monthlySchedule: z.array(monthlyEntrySchema).default([]),
        // Additional compensation
        additionalCompensations: z.array(additionalCompensationSchema).default([]),
        // Draft
        isDraft: z.boolean().default(false),
        // Legacy/shared fields
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
    }),
});

export const updateSalarySchema = z.object({
    body: z.object({
        salaryType: z.enum(['yearly', 'monthly']).optional(),
        compensationType: z.enum(['salary', 'stipend', 'contract']).optional(),
        basic: z.number().min(0).optional(),
        specialAllowance: z.number().min(0).optional(),
        annualAmount: z.number().min(0).optional(),
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
        firstSalaryDate: z.string().optional(),
        monthlySchedule: z.array(monthlyEntrySchema).optional(),
        additionalCompensations: z.array(additionalCompensationSchema).optional(),
        isDraft: z.boolean().optional(),
    }),
    params: z.object({ id: z.string() }),
});

export type CreateSalaryInput = z.infer<typeof createSalarySchema>['body'];
export type UpdateSalaryInput = z.infer<typeof updateSalarySchema>['body'];
