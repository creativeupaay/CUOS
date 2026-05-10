import { Types } from 'mongoose';
import AppError from '../../../utils/appError';
import { Project } from '../models/Project.model';
import { DocFolder } from '../models/DocFolder.model';
import { DocItem } from '../models/DocItem.model';
import { DeletedRecordService } from '../../archive';

/**
 * Ensures exactly one root-level system "Shared Files" folder per project.
 * If duplicates exist, it merges file/subfolder references into a primary folder.
 */
export const ensureUnifiedSharedFolder = async (projectId: string) => {
    const projectObjectId = new Types.ObjectId(projectId);

    const candidates = await DocFolder.find({
        projectId: projectObjectId,
        parentId: null,
        isSystem: true,
        $or: [
            { name: 'Shared Files' },
            { isClientShared: true },
            { isPartnerShared: true },
        ],
    })
        .sort({ createdAt: 1 })
        .lean();

    if (candidates.length === 0) {
        const project = await Project.findById(projectId).select('createdBy').lean();
        if (!project) {
            throw new AppError('Project not found', 404);
        }

        const created = await DocFolder.create({
            projectId: projectObjectId,
            name: 'Shared Files',
            parentId: null,
            createdBy: project.createdBy,
            viewAccess: [],
            isSystem: true,
            isClientShared: true,
            isPartnerShared: true,
        });

        return created.toObject();
    }

    const primary = candidates[0];
    const duplicateIds = candidates.slice(1).map((f) => f._id);
    const mergedViewAccess = Array.from(
        new Set(
            candidates
                .flatMap((folder) => folder.viewAccess || [])
                .map((id) => id.toString())
        )
    ).map((id) => new Types.ObjectId(id));

    if (
        primary.name !== 'Shared Files' ||
        !primary.isClientShared ||
        !primary.isPartnerShared
    ) {
        await DocFolder.findByIdAndUpdate(primary._id, {
            $set: {
                name: 'Shared Files',
                isSystem: true,
                isClientShared: true,
                isPartnerShared: true,
                viewAccess: mergedViewAccess,
            },
        });
    } else if (mergedViewAccess.length !== (primary.viewAccess || []).length) {
        await DocFolder.findByIdAndUpdate(primary._id, {
            $set: { viewAccess: mergedViewAccess },
        });
    }

    if (duplicateIds.length > 0) {
        const duplicateFolders = await DocFolder.find({ _id: { $in: duplicateIds } });
        const archiveBatchId = DeletedRecordService.generateArchiveBatchId();

        await DeletedRecordService.archiveDocuments(duplicateFolders, {
            archiveBatchId,
            reason: 'Shared folder duplicate merge cleanup',
            operation: 'delete',
            metadata: {
                projectId,
                primaryFolderId: primary._id.toString(),
                duplicateFolderIds: duplicateIds.map((id) => id.toString()),
                mergeCleanup: true,
            },
        });

        await DocItem.updateMany(
            { projectId: projectObjectId, folderId: { $in: duplicateIds } },
            { $set: { folderId: primary._id } }
        );

        await DocFolder.updateMany(
            { projectId: projectObjectId, parentId: { $in: duplicateIds } },
            { $set: { parentId: primary._id } }
        );

        await DocFolder.deleteMany({ _id: { $in: duplicateIds } });
    }

    const normalized = await DocFolder.findById(primary._id).lean();
    if (!normalized) {
        throw new AppError('Failed to resolve shared folder', 500);
    }

    return normalized;
};
