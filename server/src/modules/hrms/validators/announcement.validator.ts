import { z } from 'zod';

export const createAnnouncementSchema = z.object({
    body: z.object({
        title: z.string().trim().max(150).optional().default('Company Announcement'),
        content: z.string().trim().min(1, 'Announcement content is required'),
        priority: z.enum(['normal', 'urgent']).optional().default('normal'),
        isPinned: z.boolean().optional().default(false),
        targetType: z.enum(['all', 'department', 'users']).optional().default('all'),
        targetDepartments: z.array(z.string().trim()).optional().default([]),
        targetUsers: z.array(z.string().trim()).optional().default([]),
        poll: z
            .object({
                question: z.string().trim().min(1, 'Poll question is required'),
                options: z
                    .array(z.string().trim().min(1, 'Option text cannot be empty'))
                    .min(2, 'At least 2 options are required for a poll'),
                allowMultiple: z.boolean().optional().default(false),
            })
            .optional(),
    }),
});

export const deleteAnnouncementSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Announcement ID is required'),
    }),
});

export const acknowledgeAnnouncementSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Announcement ID is required'),
    }),
});

export const nudgeAnnouncementSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Announcement ID is required'),
    }),
});

export const votePollSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Announcement ID is required'),
    }),
    body: z.object({
        optionIds: z.array(z.string().min(1)).min(1, 'Please select at least one option'),
    }),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>['body'];
export type VotePollInput = z.infer<typeof votePollSchema>['body'];

