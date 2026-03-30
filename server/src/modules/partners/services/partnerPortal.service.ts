import { Types } from 'mongoose';
import { Project } from '../../project/models/Project.model';
import { DocItem } from '../../project/models/DocItem.model';
import AppError from '../../../utils/appError';
import { uploadDocument, getSignedUrl } from '../../../utils/cloudinary.util';
import { ensureUnifiedSharedFolder } from '../../project/services/sharedFolder.service';

// ─── Documents (Shared Files folder only) ─────────────────────────────────────

/**
 * Get shared folder for partner portal
 * Partners only see the "Shared Files" folder (same as clients)
 */
async function getSharedFolder(projectId: string) {
    return ensureUnifiedSharedFolder(projectId);
}

/**
 * Assert that the partner owns the project
 */
async function assertProjectOwnership(partnerId: string, projectId: string): Promise<void> {
    const project = await Project.findOne({
        _id: new Types.ObjectId(projectId),
        partnerId: new Types.ObjectId(partnerId),
        isArchived: false,
    })
        .select('_id')
        .lean();

    if (!project) throw new AppError('Project not found or access denied', 404);
}

/**
 * Get documents in the shared folder for a partner's project
 */
export const getPartnerPortalDocuments = async (partnerId: string, projectId: string) => {
    await assertProjectOwnership(partnerId, projectId);

    const sharedFolder = await getSharedFolder(projectId);

    const items = await DocItem.find({
        projectId: new Types.ObjectId(projectId),
        folderId: sharedFolder._id,
    })
        .populate('uploadedBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();

    return { folder: sharedFolder, items };
};

/**
 * Upload document to the shared folder from partner portal
 */
export const uploadPartnerPortalDocument = async (
    partnerId: string,
    projectId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number,
    uploadedByUserId: string
) => {
    await assertProjectOwnership(partnerId, projectId);
    const sharedFolder = await getSharedFolder(projectId);

    const cloudFolder = `projects/${projectId}/docs/${sharedFolder._id.toString()}/partner`;
    const uploadResult = await uploadDocument(fileBuffer, cloudFolder, fileName);

    const item = await DocItem.create({
        projectId: new Types.ObjectId(projectId),
        folderId: sharedFolder._id,
        name: fileName,
        cloudinaryId: uploadResult.cloudinaryId,
        size: uploadResult.size || fileSize,
        mimeType,
        uploadedBy: new Types.ObjectId(uploadedByUserId),
        viewAccess: [],
    });

    return item;
};

/**
 * Get signed URL for a document in partner portal
 */
export const getPartnerPortalDocumentUrl = async (
    partnerId: string,
    projectId: string,
    itemId: string
) => {
    await assertProjectOwnership(partnerId, projectId);
    const item = await DocItem.findById(itemId).lean();
    if (!item) throw new AppError('File not found', 404);

    // Verify the item belongs to the shared folder
    const sharedFolder = await getSharedFolder(projectId);
    if (item.folderId?.toString() !== sharedFolder._id.toString()) {
        throw new AppError('Access denied', 403);
    }

    return getSignedUrl(item.cloudinaryId, 3600);
};

/**
 * Get partner's projects
 */
export const getPartnerPortalProjects = async (partnerId: string) => {
    const projects = await Project.find({
        partnerId: new Types.ObjectId(partnerId),
        isArchived: false,
    })
        .select('name description status priority startDate endDate deadline budget currency billingType')
        .sort({ updatedAt: -1 })
        .lean();

    return projects;
};

/**
 * Get single project details for partner
 */
export const getPartnerPortalProject = async (partnerId: string, projectId: string) => {
    const project = await Project.findOne({
        _id: new Types.ObjectId(projectId),
        partnerId: new Types.ObjectId(partnerId),
        isArchived: false,
    })
        .select('name description status priority startDate endDate deadline budget currency billingType phases')
        .lean();

    if (!project) throw new AppError('Project not found', 404);
    return project;
};
