import { z } from 'zod';

const checklistItemSchema = z.object({
    id: z.string().min(1),
    text: z.string().min(1).max(500),
    checked: z.boolean().default(false),
});

const contentBlockSchema = z.discriminatedUnion('type', [
    z.object({
        id: z.string().min(1),
        type: z.literal('text'),
        content: z.string().max(10000).optional(),
    }),
    z.object({
        id: z.string().min(1),
        type: z.literal('checklist'),
        items: z.array(checklistItemSchema).max(100).optional(),
    }),
    z.object({
        id: z.string().min(1),
        type: z.literal('image'),
        cloudinaryId: z.string().optional(),
        url: z.string().url().optional(),
        caption: z.string().max(300).optional(),
    }),
]);

export const createNoteSchema = z.object({
    params: z.object({
        projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID'),
    }),
    body: z.object({
        title: z.string().min(1, 'Title is required').max(200),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        isPinned: z.boolean().optional(),
        blocks: z.array(contentBlockSchema).max(50).optional(),
    }),
});

export const updateNoteSchema = z.object({
    params: z.object({
        projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID'),
        noteId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid note ID'),
    }),
    body: z.object({
        title: z.string().min(1).max(200).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        isPinned: z.boolean().optional(),
        blocks: z.array(contentBlockSchema).max(50).optional(),
    }),
});

export const deleteNoteSchema = z.object({
    params: z.object({
        projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID'),
        noteId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid note ID'),
    }),
});

export const getNotesSchema = z.object({
    params: z.object({
        projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID'),
    }),
});

export const uploadNoteImageSchema = z.object({
    params: z.object({
        projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID'),
    }),
});
