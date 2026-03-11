import { Types } from 'mongoose';
import { Note, INote } from '../models/Note.model';
import AppError from '../../../utils/appError';
import { uploadDocument } from '../../../utils/cloudinary.util';

const ADMIN_ROLES = ['super-admin', 'super_admin', 'admin'];

class NoteService {
    // ── CRUD ─────────────────────────────────────────────────────────

    async createNote(data: {
        projectId: string;
        title: string;
        color?: string;
        isPinned?: boolean;
        blocks?: any[];
        createdBy: string;
    }): Promise<INote> {
        const note = await Note.create({
            ...data,
            blocks: data.blocks ?? [],
        });
        await note.populate('createdBy', 'name email');
        return note;
    }

    async getNotes(projectId: string): Promise<INote[]> {
        return Note.find({ projectId })
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')
            .sort({ isPinned: -1, createdAt: -1 });
    }

    async updateNote(
        noteId: string,
        userId: string,
        userRole: string,
        data: {
            title?: string;
            color?: string;
            isPinned?: boolean;
            blocks?: any[];
        }
    ): Promise<INote> {
        const note = await Note.findById(noteId);
        if (!note) throw new AppError('Note not found', 404);

        // All project members can edit notes — no ownership restriction.
        // updatedBy is tracked for audit purposes.

        if (data.title !== undefined) note.title = data.title;
        if (data.color !== undefined) note.color = data.color;
        if (data.isPinned !== undefined) note.isPinned = data.isPinned;
        if (data.blocks !== undefined) note.blocks = data.blocks as any;

        note.updatedBy = new Types.ObjectId(userId);
        note.lastEditedAt = new Date();

        await note.save();
        await note.populate([
            { path: 'createdBy', select: 'name email' },
            { path: 'updatedBy', select: 'name email' },
        ]);
        return note;
    }

    async deleteNote(noteId: string, userId: string, userRole: string): Promise<void> {
        const note = await Note.findById(noteId);
        if (!note) throw new AppError('Note not found', 404);

        const isAdmin = ADMIN_ROLES.includes(userRole);
        const isOwner = note.createdBy.toString() === userId;
        if (!isAdmin && !isOwner) {
            throw new AppError('You do not have permission to delete this note', 403);
        }

        await note.deleteOne();
    }

    // ── Image upload ─────────────────────────────────────────────────

    async uploadImage(
        projectId: string,
        fileBuffer: Buffer,
        fileName: string
    ): Promise<{ cloudinaryId: string; url: string }> {
        const result = await uploadDocument(
            fileBuffer,
            `cuos/projects/${projectId}/notes`,
            fileName,
            false // public — images need to render directly in note cards
        );
        return { cloudinaryId: result.cloudinaryId, url: result.url };
    }
}

export default new NoteService();
