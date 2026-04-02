import { Types } from 'mongoose';
import { Note, INote } from '../models/Note.model';
import { Project } from '../models/Project.model';
import { User } from '../../auth/models/User.model';
import { notificationService } from '../../notification/services/notification.service';
import AppError from '../../../utils/appError';
import { uploadDocument } from '../../../utils/cloudinary.util';
import { extractNoteMentions } from '../utils/noteMention.util';

const ADMIN_ROLES = ['super-admin', 'super_admin', 'admin'];

class NoteService {
    private async getProjectMemberMap(projectId: string): Promise<Map<string, string>> {
        const project = await Project.findById(projectId)
            .populate({
                path: 'assignees.employeeId',
                select: 'userId',
            })
            .populate('assignees.partnerEmployeeId', '_id')
            .lean();

        if (!project) {
            throw new AppError('Project not found', 404);
        }

        const members = new Map<string, string>();

        project.assignees.forEach((assignee: any) => {
            const employeeUserId =
                assignee?.userId?.toString?.() ||
                assignee?.employeeId?.userId?.toString?.();
            if (employeeUserId) {
                members.set(employeeUserId, employeeUserId);
            }

            const partnerEmployeeUserId =
                assignee?.partnerEmployeeId?._id?.toString?.() ||
                assignee?.partnerEmployeeId?.toString?.();
            if (partnerEmployeeUserId) {
                members.set(partnerEmployeeUserId, partnerEmployeeUserId);
            }
        });

        return members;
    }

    private async buildValidatedMentions(projectId: string, blocks: any[] = []) {
        const extractedMentions = extractNoteMentions(blocks as any);
        if (extractedMentions.length === 0) {
            return [];
        }

        const memberMap = await this.getProjectMemberMap(projectId);
        return extractedMentions.filter((mention) => memberMap.has(mention.userId.toString()));
    }

    private async notifyNewMentions(note: INote, previousMentionIds: Set<string>, actorUserId: string) {
        const freshMentions = note.mentions.filter((mention) => {
            const userId = mention.userId.toString();
            return userId !== actorUserId && !previousMentionIds.has(mention.mentionId);
        });

        if (freshMentions.length === 0) {
            return;
        }

        const actor = await User.findById(actorUserId).select('name').lean();
        const actorName = actor?.name || 'A team member';
        const noteTitle = note.title?.trim() || 'Untitled';

        await Promise.all(
            freshMentions.map((mention) =>
                notificationService.createNotification({
                    userId: mention.userId,
                    type: 'note_mentioned',
                    title: 'You were mentioned in a note',
                    message: `${actorName} mentioned you in "${noteTitle}"`,
                    link: `/projects/${note.projectId.toString()}/notes?noteId=${note._id.toString()}&blockId=${mention.blockId}&mentionId=${mention.mentionId}`,
                    metadata: {
                        projectId: note.projectId.toString(),
                        noteId: note._id.toString(),
                        blockId: mention.blockId,
                        mentionId: mention.mentionId,
                        mentionedBy: actorUserId,
                    },
                })
            )
        );
    }

    // ── CRUD ─────────────────────────────────────────────────────────

    async createNote(data: {
        projectId: string;
        title: string;
        color?: string;
        isPinned?: boolean;
        blocks?: any[];
        createdBy: string;
    }): Promise<INote> {
        const mentions = await this.buildValidatedMentions(data.projectId, data.blocks ?? []);
        const note = await Note.create({
            ...data,
            blocks: data.blocks ?? [],
            mentions,
        });
        await note.populate('createdBy', 'name email');
        await this.notifyNewMentions(note, new Set(), data.createdBy);
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
        const previousMentionIds = new Set(note.mentions.map((mention) => mention.mentionId));
        if (data.blocks !== undefined) {
            note.blocks = data.blocks as any;
            note.mentions = await this.buildValidatedMentions(note.projectId.toString(), data.blocks);
        }

        note.updatedBy = new Types.ObjectId(userId);
        note.lastEditedAt = new Date();

        await note.save();
        await note.populate([
            { path: 'createdBy', select: 'name email' },
            { path: 'updatedBy', select: 'name email' },
        ]);
        await this.notifyNewMentions(note, previousMentionIds, userId);
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
