import { z } from 'zod';

export const createAnnouncementSchema = z.object({
    body: z.object({
        content: z.string().trim().min(1, 'Announcement content is required'),
    }),
});

export const deleteAnnouncementSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Announcement ID is required'),
    }),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>['body'];
