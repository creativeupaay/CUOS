import { z } from 'zod';

// ── Employee Validators ─────────────────────────────────────────────

const personalInfoSchema = z.object({
    dob: z.string().optional(),
    gender: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['male', 'female', 'other']).optional()),
    phone: z.string().optional(),
    emergencyContact: z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        relation: z.string().optional(),
    }).optional(),
    bloodGroup: z.string().optional(),
    address: z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
    }).optional(),
}).optional();

const bankDetailsSchema = z.object({
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
    panNumber: z.string().optional(),
}).optional();

const workScheduleSchema = z.object({
    workingDaysPerWeek: z.number().min(1).max(7).default(5),
    hoursPerDay: z.number().min(1).max(24).default(8),
}).optional();

const onboardingChecklistItemSchema = z.object({
    item: z.string().min(1),
    completed: z.boolean().default(false),
});

export const createEmployeeSchema = z.object({
    body: z.object({
        userId: z.string().min(1, 'User ID is required'),
        employeeId: z.string().min(1, 'Employee ID is required'),
        designation: z.string().min(1, 'Designation is required'),
        department: z.enum(['engineering', 'design', 'marketing', 'finance', 'hr', 'admin']),
        employmentType: z.enum(['full-time', 'part-time', 'contract', 'intern']).default('full-time'),
        joiningDate: z.string().min(1, 'Joining date is required'),
        probationEndDate: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
        status: z.enum(['active', 'on-notice', 'relieved', 'terminated']).default('active'),
        reportingTo: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
        workSchedule: workScheduleSchema,
        personalInfo: personalInfoSchema,
        bankDetails: bankDetailsSchema,
        onboarding: z.object({
            status: z.enum(['not-started', 'in-progress', 'completed']).default('not-started'),
            checklist: z.array(onboardingChecklistItemSchema).default([]),
        }).optional(),
    }),
});

export const updateEmployeeSchema = z.object({
    body: z.object({
        designation: z.string().optional(),
        department: z.enum(['engineering', 'design', 'marketing', 'finance', 'hr', 'admin']).optional(),
        employmentType: z.enum(['full-time', 'part-time', 'contract', 'intern']).optional(),
        probationEndDate: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
        status: z.enum(['active', 'on-notice', 'relieved', 'terminated']).optional(),
        reportingTo: z.preprocess((v) => (v === '' ? undefined : v), z.string().nullable().optional()),
        workSchedule: workScheduleSchema,
        personalInfo: personalInfoSchema,
        bankDetails: bankDetailsSchema,
        onboarding: z.object({
            status: z.enum(['not-started', 'in-progress', 'completed']).optional(),
            checklist: z.array(onboardingChecklistItemSchema).optional(),
        }).optional(),
    }),
    params: z.object({ id: z.string() }),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>['body'];
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>['body'];
