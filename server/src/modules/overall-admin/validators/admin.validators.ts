import { z } from 'zod';

// ── User Validators ──────────────────────────────────────────────────

export const createUserSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name is required').trim(),
        email: z.string().email('Invalid email').trim().toLowerCase(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        role: z.string().min(1, 'Role ID is required'),
        department: z.preprocess(
            (v) => (v === '' ? undefined : v),
            z.string().optional()
        ),
    }),
});

export const updateUserSchema = z.object({
    body: z.object({
        name: z.string().min(1).trim().optional(),
        email: z.string().email().trim().toLowerCase().optional(),
        role: z.string().optional(),
        department: z.preprocess(
            (v) => (v === '' ? undefined : v),
            z.string().optional()
        ),
        isActive: z.boolean().optional(),
    }),
});

export const resetPasswordSchema = z.object({
    body: z.object({
        newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    }),
});

// ── Role Validators ──────────────────────────────────────────────────

export const createRoleSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Role name is required').trim(),
        description: z.string().min(1, 'Description is required').trim(),
        permissions: z.array(z.string()).default([]),
        level: z.number().min(1).max(10),
    }),
});

export const updateRoleSchema = z.object({
    body: z.object({
        name: z.string().min(1).trim().optional(),
        description: z.string().min(1).trim().optional(),
        permissions: z.array(z.string()).optional(),
        level: z.number().min(1).max(10).optional(),
    }),
});

export const cloneRoleSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'New role name is required').trim(),
    }),
});

// ── Permission Validators ────────────────────────────────────────────

export const createPermissionSchema = z.object({
    body: z.object({
        resource: z.string().min(1, 'Resource is required').trim(),
        action: z.enum(['create', 'read', 'update', 'delete', 'manage']),
        description: z.string().min(1, 'Description is required').trim(),
    }),
});

// ── Settings Validators ──────────────────────────────────────────────

export const updateSettingsSchema = z.object({
    body: z.object({
        companyName: z.string().trim().optional(),
        companyEmail: z.string().email().trim().optional(),
        companyPhone: z.string().trim().optional(),
        address: z.object({
            street: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            country: z.string().optional(),
            zipCode: z.string().optional(),
        }).optional(),
        departments: z.array(z.string()).optional(),
        currency: z.string().trim().optional(),
        taxSettings: z.object({
            gstEnabled: z.boolean().optional(),
            gstRate: z.number().optional(),
            tdsEnabled: z.boolean().optional(),
            tdsRate: z.number().optional(),
        }).optional(),
        workingHours: z.object({
            startTime: z.string().optional(),
            endTime: z.string().optional(),
            daysPerWeek: z.number().optional(),
            hoursPerDay: z.number().optional(),
        }).optional(),
        featureToggles: z.object({
            projectManagement: z.boolean().optional(),
            finance: z.boolean().optional(),
            crm: z.boolean().optional(),
            hrms: z.boolean().optional(),
            leads: z.boolean().optional(),
        }).optional(),
        passwordPolicy: z.object({
            minLength: z.number().optional(),
            requireUppercase: z.boolean().optional(),
            requireLowercase: z.boolean().optional(),
            requireNumbers: z.boolean().optional(),
            requireSpecialChars: z.boolean().optional(),
        }).optional(),
        sessionExpiryMinutes: z.number().min(5).max(1440).optional(),
    }),
});
