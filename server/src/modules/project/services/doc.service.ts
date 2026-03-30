import { Types } from 'mongoose';
import { DocFolder, IDocFolder } from '../models/DocFolder.model';
import { DocItem, IDocItem } from '../models/DocItem.model';
import { Project } from '../models/Project.model';
import { Employee } from '../../hrms/models/Employee.model';
import {
    uploadDocument,
    deleteDocument,
    getSignedUrl,
} from '../../../utils/cloudinary.util';
import AppError from '../../../utils/appError';
import { ensureUnifiedSharedFolder } from './sharedFolder.service';
import { notificationService } from '../../notification/services/notification.service';

// ─── Access Helpers ──────────────────────────────────────────────────────────

/**
 * Convert a mix of Employee IDs and User IDs to User IDs only.
 * This handles cases where the frontend might send either type.
 */
const convertToUserIds = async (ids: string[]): Promise<string[]> => {
    if (ids.length === 0) return [];

    // Try to find employees with these IDs
    const employees = await Employee.find({
        _id: { $in: ids.map(id => new Types.ObjectId(id)) }
    }).select('userId').lean();

    const foundEmployeeIds = employees.map(e => e._id.toString());
    const userIdsFromEmployees = employees.map(e => e.userId.toString());

    // IDs that weren't found as employees are assumed to be User IDs already
    const directUserIds = ids.filter(id => !foundEmployeeIds.includes(id));

    // Combine both sets
    return [...userIdsFromEmployees, ...directUserIds];
};

/**
 * Convert User IDs back to Employee information for frontend display.
 * This allows the frontend to show correct selections in admin management UI.
 */
const convertToEmployeeData = async (userIds: Types.ObjectId[]): Promise<any[]> => {
    if (userIds.length === 0) return [];

    console.log('[convertToEmployeeData] Input User IDs:', userIds.map(id => id.toString()));

    // Find employees whose userId matches the stored User IDs
    const employees = await Employee.find({
        userId: { $in: userIds }
    })
    .populate('userId', 'name email')
    .select('_id userId')
    .lean();

    console.log('[convertToEmployeeData] Found employees:', employees.length);
    console.log('[convertToEmployeeData] Employee details:', employees.map(e => ({
        employeeId: e._id.toString(),
        userId: e.userId.toString(),
        userDetails: (e.userId as any)
    })));

    // Return employee data with Employee ID and user details
    const result = employees.map(employee => ({
        _id: employee._id, // Employee ID for frontend selection
        name: (employee.userId as any)?.name,
        email: (employee.userId as any)?.email,
    }));

    console.log('[convertToEmployeeData] Final result:', result);
    return result;
};

/**
 * Check if userId is a doc admin on this project (or super-admin / admin via role).
 */
export const isDocAdmin = async (
    projectId: string,
    userId: string,
    userRole?: string
): Promise<boolean> => {
    // Role-based access (super-admin/admin always have access)
    if (userRole === 'super-admin' || userRole === 'admin' || userRole === 'super_admin') {
        return true;
    }

    const project = await Project.findById(projectId).select('docAdmins').lean();
    if (!project) return false;

    const docAdmins = project.docAdmins ?? [];
    const normalizedUserId = userId.toString().trim();

    const isAdmin = docAdmins.some((id) => id.toString().trim() === normalizedUserId);

    // Debug logging (remove in production if needed)
    console.log('[isDocAdmin] Debug Info:', {
        projectId,
        userId: normalizedUserId,
        userRole,
        docAdmins: docAdmins.map(id => id.toString()),
        isAdmin,
    });

    return isAdmin;
};

// ─── Folder Operations ───────────────────────────────────────────────────────

/**
 * Get folders at a given level. Admins see all; viewers see folders where
 * they are in viewAccess OR created OR where an ancestor grants them access.
 */
export const getFolders = async (
    projectId: string,
    parentId: string | null,
    userId: string,
    userRole?: string,
    isPartnerRequest: boolean = false
): Promise<IDocFolder[]> => {
    console.log('[getFolders] Starting with params:', { projectId, parentId, userId, userRole, isPartnerRequest });

    const admin = await isDocAdmin(projectId, userId, userRole);
    const userObjectId = new Types.ObjectId(userId);

    console.log('[getFolders] Admin check result:', admin);

    // Normalize legacy data so only one shared folder exists across CUOS/partner/client.
    if (!parentId) {
        await ensureUnifiedSharedFolder(projectId);
    }

    const query: Record<string, unknown> = {
        projectId: new Types.ObjectId(projectId),
        parentId: parentId ? new Types.ObjectId(parentId) : null,
    };

    console.log('[getFolders] Base query:', query);

    if (!admin) {
        if (isPartnerRequest && !parentId) {
            const sharedFolder = await ensureUnifiedSharedFolder(projectId);
            query.$or = [
                { viewAccess: userObjectId },
                { createdBy: userObjectId },
                { _id: sharedFolder._id },
            ];
        } else {
            query.$or = [
                { viewAccess: userObjectId },
                { createdBy: userObjectId },
            ];
        }
        console.log('[getFolders] Non-admin query with filters:', query);
    } else {
        console.log('[getFolders] Admin query - NO FILTERS (should see all)');
    }

    const results = await DocFolder.find(query)
        .populate('createdBy', 'name email')
        .populate('viewAccess', 'name email')
        .sort({ name: 1 })
        .lean();

    console.log('[getFolders] Final results count:', results.length);
    console.log('[getFolders] Folder names:', results.map(f => f.name));

    return results;
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
 * Accepts both Employee IDs and User IDs, converts to User IDs before storing.
 */
export const updateFolderAccess = async (
    folderId: string,
    viewAccess: string[]
): Promise<IDocFolder> => {
    // Convert Employee IDs to User IDs if needed
    const actualUserIds = await convertToUserIds(viewAccess);

    const folder = await DocFolder.findByIdAndUpdate(
        folderId,
        { viewAccess: actualUserIds.map((id) => new Types.ObjectId(id)) },
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
 * either via folder.viewAccess, file.viewAccess, or files they uploaded.
 */
export const getDocItems = async (
    projectId: string,
    folderId: string | null,
    userId: string,
    userRole?: string,
    isPartnerRequest: boolean = false
): Promise<IDocItem[]> => {
    console.log('[getDocItems] Starting with params:', { projectId, folderId, userId, userRole, isPartnerRequest });

    const admin = await isDocAdmin(projectId, userId, userRole);
    const userObjectId = new Types.ObjectId(userId);

    console.log('[getDocItems] Admin check result:', admin);

    const query: Record<string, unknown> = {
        projectId: new Types.ObjectId(projectId),
        folderId: folderId ? new Types.ObjectId(folderId) : null,
    };

    console.log('[getDocItems] Base query:', query);

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
            // Only files where user has direct view access OR files they uploaded
            query.$or = [
                { viewAccess: userObjectId },      // Files shared with them
                { uploadedBy: userObjectId },      // Files they uploaded
            ];
        }
        console.log('[getDocItems] Non-admin query with filters:', { hasFolderAccess, query });
    } else {
        console.log('[getDocItems] Admin query - NO FILTERS (should see all)');
    }

    const results = await DocItem.find(query)
        .populate('uploadedBy', 'name email')
        .populate('viewAccess', 'name email')
        .sort({ name: 1 })
        .lean();

    console.log('[getDocItems] Final results count:', results.length);
    console.log('[getDocItems] File names:', results.map(f => f.name));

    return results;
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
 * Accepts both Employee IDs and User IDs, converts to User IDs before storing.
 */
export const updateDocItemAccess = async (
    itemId: string,
    viewAccess: string[]
): Promise<IDocItem> => {
    // Convert Employee IDs to User IDs if needed
    const actualUserIds = await convertToUserIds(viewAccess);

    // Get the current item to compare access changes
    const currentItem = await DocItem.findById(itemId).populate('projectId', 'name').lean();
    if (!currentItem) throw new AppError('File not found', 404);

    const previousAccess = currentItem.viewAccess.map((id) => id.toString());
    const newUserIds = actualUserIds.filter((id) => !previousAccess.includes(id));

    const item = await DocItem.findByIdAndUpdate(
        itemId,
        { viewAccess: actualUserIds.map((id) => new Types.ObjectId(id)) },
        { new: true }
    ).populate([
        { path: 'uploadedBy', select: 'name email' },
        { path: 'viewAccess', select: 'name email' },
    ]);

    if (!item) throw new AppError('File not found', 404);

    // Notify new users about document access
    if (newUserIds.length > 0) {
        const projectName = (currentItem.projectId as any)?.name || 'a project';

        for (const userId of newUserIds) {
            notificationService.createNotification({
                userId,
                type: 'document_access_granted',
                title: 'Document Access Granted',
                message: `You have been granted access to "${item.name}" in ${projectName}.`,
                link: `/projects/${currentItem.projectId}?tab=documents`,
                metadata: {
                    projectId: currentItem.projectId.toString(),
                    documentId: item._id.toString(),
                    documentName: item.name,
                },
            });
        }
    }

    return item;
};

// ─── Doc Admin Operations ────────────────────────────────────────────────────

/**
 * Get doc admins for a project.
 * Returns User IDs for frontend admin access checks.
 */
export const getDocAdmins = async (projectId: string) => {
    const project = await Project.findById(projectId)
        .select('docAdmins')
        .lean();

    if (!project) throw new AppError('Project not found', 404);
    if (!project.docAdmins?.length) return [];

    // Return User IDs directly for frontend admin checks
    // Frontend expects User IDs to match currentUser._id
    return project.docAdmins.map(id => ({ _id: id.toString() }));
};

/**
 * Set doc admins for a project.
 * Accepts both Employee IDs and User IDs, converts to User IDs before storing.
 */
export const updateDocAdmins = async (
    projectId: string,
    userIds: string[]
): Promise<void> => {
    console.log('[updateDocAdmins] Input:', { projectId, userIds });

    // Convert Employee IDs to User IDs if needed
    const actualUserIds = await convertToUserIds(userIds);

    console.log('[updateDocAdmins] Converted User IDs:', actualUserIds);

    await Project.findByIdAndUpdate(projectId, {
        docAdmins: actualUserIds.map((id) => new Types.ObjectId(id)),
    });

    console.log('[updateDocAdmins] Successfully updated doc admins for project:', projectId);
};
