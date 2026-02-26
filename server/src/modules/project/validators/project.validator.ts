import { z } from 'zod';

// Project Schemas
export const createProjectSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Project name is required').trim(),
        description: z.string().optional(),
        status: z.enum(['planning', 'active', 'on-hold', 'completed', 'cancelled']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),

        clientId: z.string().min(1, 'Client ID is required'),

        startDate: z.string().or(z.date()),
        endDate: z.string().or(z.date()).optional(),
        deadline: z.string().or(z.date()).optional(),

        budget: z.number().positive().optional(),
        currency: z.string().default('USD'),
        billingType: z.enum(['fixed', 'hourly', 'milestone']).default('fixed'),
        hourlyRate: z.number().positive().optional(),

        invoiceDetails: z.object({
            invoiceNumber: z.string().optional(),
            invoiceDate: z.string().or(z.date()).optional(),
            invoiceAmount: z.number().positive().optional(),
            paymentStatus: z.enum(['pending', 'partial', 'paid']).optional(),
            paymentTerms: z.string().optional(),
        }).optional(),

        assignees: z.array(z.object({
            userId: z.string(),
            role: z.enum(['manager', 'developer', 'designer', 'qa', 'viewer']),
            subModules: z.object({
                overview: z.boolean(),
                tasks: z.boolean(),
                timeLogs: z.boolean(),
                meetings: z.boolean(),
                credentials: z.boolean(),
                documents: z.boolean(),
            }).optional(),
        })).optional(),

        phases: z.array(z.object({
            name: z.string().min(1, 'Phase name is required'),
            status: z.enum(['pending', 'in-progress', 'completed']).optional().default('pending'),
            startDate: z.string().or(z.date()).optional(),
            endDate: z.string().or(z.date()).optional(),
        })).optional(),
    }),
});

export const updateProjectSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Project ID is required'),
    }),
    body: z.object({
        name: z.string().min(1).trim().optional(),
        description: z.string().optional(),
        status: z.enum(['planning', 'active', 'on-hold', 'completed', 'cancelled']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),

        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        deadline: z.string().or(z.date()).optional(),

        budget: z.number().positive().optional(),
        currency: z.string().optional(),
        billingType: z.enum(['fixed', 'hourly', 'milestone']).optional(),
        hourlyRate: z.number().positive().optional(),

        invoiceDetails: z.object({
            invoiceNumber: z.string().optional(),
            invoiceDate: z.string().or(z.date()).optional(),
            invoiceAmount: z.number().positive().optional(),
            paymentStatus: z.enum(['pending', 'partial', 'paid']).optional(),
            paymentTerms: z.string().optional(),
        }).optional(),

        phases: z.array(z.object({
            name: z.string().min(1, 'Phase name is required'),
            status: z.enum(['pending', 'in-progress', 'completed']).optional(),
            startDate: z.string().or(z.date()).optional(),
            endDate: z.string().or(z.date()).optional(),
        })).optional(),
    }),
});

export const addAssigneeSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Project ID is required'),
    }),
    body: z.object({
        employeeId: z.string().min(1, 'Employee ID is required'),
        role: z.enum(['manager', 'developer', 'designer', 'qa', 'viewer']),
        subModules: z.object({
            overview: z.boolean(),
            tasks: z.boolean(),
            timeLogs: z.boolean(),
            meetings: z.boolean(),
            credentials: z.boolean(),
            documents: z.boolean(),
        }).optional(),
    }),
});

export const removeAssigneeSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Project ID is required'),
        employeeId: z.string().min(1, 'Employee ID is required'),
    }),
});

export const updateAssigneePermissionsSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Project ID is required'),
        employeeId: z.string().min(1, 'Employee ID is required'),
    }),
    body: z.object({
        subModules: z.object({
            overview: z.boolean(),
            tasks: z.boolean(),
            timeLogs: z.boolean(),
            meetings: z.boolean(),
            credentials: z.boolean(),
            documents: z.boolean(),
        }),
    }),
});

export const uploadDocumentSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Project ID is required'),
    }),
    body: z.object({
        name: z.string().min(1, 'Document name is required'),
        type: z.enum(['contract', 'proposal', 'invoice', 'other']),
    }),
});

export const getDocumentSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Project ID is required'),
        docId: z.string().min(1, 'Document ID is required'),
    }),
});

export const deleteDocumentSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Project ID is required'),
        docId: z.string().min(1, 'Document ID is required'),
    }),
});

export const getProjectByIdSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Project ID is required'),
    }),
});
