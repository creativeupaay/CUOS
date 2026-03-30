import { Types } from 'mongoose';
import { DocFolder, IDocFolder } from '../models/DocFolder.model';
import { DocItem, IDocItem } from '../models/DocItem.model';
import { Project } from '../models/Project.model';
import {
    uploadDocument,
    deleteDocument,
    getSignedUrl,
} from '../../../utils/cloudinary.util';
import AppError from '../../../utils/appError';
import { ensureUnifiedSharedFolder } from './sharedFolder.service';

// ─── Access Helpers ──────────────────────────────────────────────────────────

/**
 * Check if userId is a doc admin on this project (or super-admin / admin via role).
 */
export const isDocAdmin = async (
    projectId: string,
    userId: string,
    userRole?: string
): Promise<boolean> => {
    if (userRole === 'super-admin' || userRole === 'admin') return true;
    const project = await Project.findById(projectId).select('docAdmins').lean();
    if (!project) return false;
    return (project.docAdmins ?? []).some((id) => id.toString() === userId);
};

// ─── Folder Operations ───────────────────────────────────────────────────────

/**
 * Get folders at a given level. Admins see all; viewers see folders where
 * they are in viewAccess OR where an ancestor grants them access.
 */
export const getFolders = async (
    projectId: string,
    parentId: string | null,
    userId: string,
    userRole?: string,
    isPartnerRequest: boolean = false
): Promise<IDocFolder[]> => {
    const admin = await isDocAdmin(projectId, userId, userRole);

    // Normalize legacy data so only one shared folder exists across CUOS/partner/client.
    if (!parentId) {
        await ensureUnifiedSharedFolder(projectId);
    }

    const query: Record<string, unknown> = {
        projectId: new Types.ObjectId(projectId),
        parentId: parentId ? new Types.ObjectId(parentId) : null,
    };

    if (!admin) {
        if (isPartnerRequest && !parentId) {
            const sharedFolder = await ensureUnifiedSharedFolder(projectId);
            query.$or = [
                { viewAccess: new Types.ObjectId(userId) },
                { _id: sharedFolder._id },
            ];
        } else {
            query.viewAccess = new Types.ObjectId(userId);
        }
    }

    return DocFolder.find(query)
        .populate('createdBy', 'name email')
        .populate('viewAccess', 'name email')
        .sort({ name: 1 })
        .lean();
};

/**
 * Create a new folder.
 */
export const createFolder = async (
    projectId: string,
    name: string,
    parentId: string | null,
    createdBy: string
): Promise<IDocFolder> => {
    // Validate parent belongs to same project
    if (parentId) {
        const parent = await DocFolder.findById(parentId);
        if (!parent || parent.projectId.toString() !== projectId) {
            throw new AppError('Parent folder not found', 404);
        }
    }

    const folder = await DocFolder.create({
        projectId: new Types.ObjectId(projectId),
        name: name.trim(),
        parentId: parentId ? new Types.ObjectId(parentId) : null,
        createdBy: new Types.ObjectId(createdBy),
        viewAccess: [],
    });

    return folder.populate([
        { path: 'createdBy', select: 'name email' },
        { path: 'viewAccess', select: 'name email' },
    ]);
};

/**
 * Rename a folder.
 */
export const renameFolder = async (
    folderId: string,
    name: string
): Promise<IDocFolder> => {
    const folder = await DocFolder.findByIdAndUpdate(
        folderId,
        { name: name.trim() },
        { new: true }
    ).populate([
        { path: 'createdBy', select: 'name email' },
        { path: 'viewAccess', select: 'name email' },
    ]);

    if (!folder) throw new AppError('Folder not found', 404);
    return folder;
};

/**
 * Delete a folder and all its subfolders + files (recursive).
 */
export const deleteFolder = async (folderId: string): Promise<void> => {
    const folder = await DocFolder.findById(folderId).lean();
    if (!folder) throw new AppError('Folder not found', 404);
    if ((folder as any).isSystem) {
        throw new AppError('The \'Shared Files\' folder cannot be deleted', 403);
    }
    await _deleteFolderRecursive(folderId);
};

const _deleteFolderRecursive = async (folderId: string): Promise<void> => {
    // Delete all files in this folder
    const files = await DocItem.find({ folderId: new Types.ObjectId(folderId) });
    for (const file of files) {
        await deleteDocument(file.cloudinaryId).catch(() => { });
        await file.deleteOne();
    }

    // Recurse into subfolders
    const subfolders = await DocFolder.find({ parentId: new Types.ObjectId(folderId) });
    for (const sub of subfolders) {
        await _deleteFolderRecursive(sub._id.toString());
    }

    // Delete this folder itself
    await DocFolder.findByIdAndDelete(folderId);
};

/**
 * Update view access on a folder.
 */
export const updateFolderAccess = async (
    folderId: string,
    viewAccess: string[]
): Promise<IDocFolder> => {
    const folder = await DocFolder.findByIdAndUpdate(
        folderId,
        { viewAccess: viewAccess.map((id) => new Types.ObjectId(id)) },
        { new: true }
    ).populate([
        { path: 'createdBy', select: 'name email' },
        { path: 'viewAccess', select: 'name email' },
    ]);

    if (!folder) throw new AppError('Folder not found', 404);
    return folder;
};

// ─── File Operations ─────────────────────────────────────────────────────────

/**
 * Get files in a folder. Admins see all; others see files they have access to
 * either via folder.viewAccess or file.viewAccess.
 */
export const getDocItems = async (
    projectId: string,
    folderId: string | null,
    userId: string,
    userRole?: string,
    isPartnerRequest: boolean = false
): Promise<IDocItem[]> => {
    const admin = await isDocAdmin(projectId, userId, userRole);

    const query: Record<string, unknown> = {
        projectId: new Types.ObjectId(projectId),
        folderId: folderId ? new Types.ObjectId(folderId) : null,
    };

    if (!admin) {
        // Check if user has folder-level access
        let hasFolderAccess = false;
        if (folderId) {
            const folder = await DocFolder.findById(folderId).lean();
            if (
                folder &&
                (
                    (isPartnerRequest && folder.isSystem && folder.isClientShared && folder.isPartnerShared) ||
                    folder.viewAccess.some((id) => id.toString() === userId)
                )
            ) {
                hasFolderAccess = true;
            }
        }

        if (!hasFolderAccess) {
            // Only files where user has direct view access
            query.viewAccess = new Types.ObjectId(userId);
        }
    }

    return DocItem.find(query)
        .populate('uploadedBy', 'name email')
        .populate('viewAccess', 'name email')
        .sort({ name: 1 })
        .lean();
};

/**
 * Upload a file to a folder.
 */
export const uploadDocItem = async (
    projectId: string,
    folderId: string | null,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number,
    uploadedBy: string
): Promise<IDocItem> => {
    if (folderId) {
        const folder = await DocFolder.findById(folderId);
        if (!folder || folder.projectId.toString() !== projectId) {
            throw new AppError('Folder not found', 404);
        }
    }

    const cloudFolder = `projects/${projectId}/docs${folderId ? `/${folderId}` : ''}`;
    const uploadResult = await uploadDocument(fileBuffer, cloudFolder, fileName);

    const item = await DocItem.create({
        projectId: new Types.ObjectId(projectId),
        folderId: folderId ? new Types.ObjectId(folderId) : null,
        name: fileName,
        cloudinaryId: uploadResult.cloudinaryId,
        size: uploadResult.size || fileSize,
        mimeType,
        uploadedBy: new Types.ObjectId(uploadedBy),
        viewAccess: [],
    });

    return item.populate([
        { path: 'uploadedBy', select: 'name email' },
        { path: 'viewAccess', select: 'name email' },
    ]);
};

/**
 * Generate a signed URL for a file.
 */
export const getDocItemUrl = async (itemId: string): Promise<string> => {
    const item = await DocItem.findById(itemId);
    if (!item) throw new AppError('File not found', 404);
    return getSignedUrl(item.cloudinaryId, 3600);
};

/**
 * Delete a file from Cloudinary and the database.
 */
export const deleteDocItem = async (itemId: string): Promise<void> => {
    const item = await DocItem.findById(itemId);
    if (!item) throw new AppError('File not found', 404);
    await deleteDocument(item.cloudinaryId).catch(() => { });
    await item.deleteOne();
};

/**
 * Rename a file.
 */
export const renameDocItem = async (
    itemId: string,
    name: string
): Promise<IDocItem> => {
    const item = await DocItem.findByIdAndUpdate(
        itemId,
        { name: name.trim() },
        { new: true }
    ).populate([
        { path: 'uploadedBy', select: 'name email' },
        { path: 'viewAccess', select: 'name email' },
    ]);

    if (!item) throw new AppError('File not found', 404);
    return item;
};

/**
 * Update view access on a file.
 */
export const updateDocItemAccess = async (
    itemId: string,
    viewAccess: string[]
): Promise<IDocItem> => {
    const item = await DocItem.findByIdAndUpdate(
        itemId,
        { viewAccess: viewAccess.map((id) => new Types.ObjectId(id)) },
        { new: true }
    ).populate([
        { path: 'uploadedBy', select: 'name email' },
        { path: 'viewAccess', select: 'name email' },
    ]);

    if (!item) throw new AppError('File not found', 404);
    return item;
};

// ─── Doc Admin Operations ────────────────────────────────────────────────────

/**
 * Get doc admins for a project (populated).
 */
export const getDocAdmins = async (projectId: string) => {
    const project = await Project.findById(projectId)
        .select('docAdmins')
        .populate('docAdmins', 'name email')
        .lean();

    if (!project) throw new AppError('Project not found', 404);
    return project.docAdmins;
};

/**
 * Set doc admins for a project.
 */
export const updateDocAdmins = async (
    projectId: string,
    userIds: string[]
): Promise<void> => {
    await Project.findByIdAndUpdate(projectId, {
        docAdmins: userIds.map((id) => new Types.ObjectId(id)),
    });
};
