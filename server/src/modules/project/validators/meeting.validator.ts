import { z } from 'zod';

export const createMeetingSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    body: z.object({
        title: z.string().min(1, 'Meeting title is required').trim(),
        description: z.string().optional(),
        type: z.enum(['internal', 'external']),

        participants: z.array(z.object({
            userId: z.string().optional(),
            externalEmail: z.string().email().optional(),
            name: z.string().optional(),
            role: z.enum(['organizer', 'required', 'optional']).optional(),
        })),

        scheduledAt: z.string().or(z.date()),
        duration: z.number().positive('Duration must be positive'), // in minutes
        location: z.string().optional(),

        agenda: z.string().optional(),
        notes: z.string().optional(),
        actionItems: z.array(z.object({
            description: z.string(),
            assignedTo: z.string().optional(),
            dueDate: z.string().or(z.date()).optional(),
            completed: z.boolean().default(false),
        })).optional(),

        accessLevel: z.enum(['project-team', 'managers-only', 'custom']).default('project-team'),
        customAccessUsers: z.array(z.string()).optional(),
    }),
});

export const updateMeetingSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        id: z.string().min(1, 'Meeting ID is required'),
    }),
    body: z.object({
        title: z.string().min(1).trim().optional(),
        description: z.string().optional(),
        type: z.enum(['internal', 'external']).optional(),

        participants: z.array(z.object({
            userId: z.string().optional(),
            externalEmail: z.string().email().optional(),
            name: z.string().optional(),
            role: z.enum(['organizer', 'required', 'optional']).optional(),
        })).optional(),

        scheduledAt: z.string().or(z.date()).optional(),
        duration: z.number().positive().optional(),
        location: z.string().optional(),

        agenda: z.string().optional(),
        notes: z.string().optional(),
        actionItems: z.array(z.object({
            description: z.string(),
            assignedTo: z.string().optional(),
            dueDate: z.string().or(z.date()).optional(),
            completed: z.boolean().default(false),
        })).optional(),

        accessLevel: z.enum(['project-team', 'managers-only', 'custom']).optional(),
        customAccessUsers: z.array(z.string()).optional(),
    }),
});

export const getMeetingsSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    query: z.object({
        type: z.enum(['internal', 'external']).optional(),
        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
    }).optional(),
});

export const getMeetingByIdSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        id: z.string().min(1, 'Meeting ID is required'),
    }),
});

export const deleteMeetingSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        id: z.string().min(1, 'Meeting ID is required'),
    }),
});
