import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { Client } from '../../client/models/Client.model';
import { Project } from '../../project/models/Project.model';
import { Task } from '../../project/models/Task.model';
import { Meeting } from '../../project/models/Meeting.model';
import { Credential } from '../../project/models/Credential.model';
import { DocFolder } from '../../project/models/DocFolder.model';
import { DocItem } from '../../project/models/DocItem.model';
import { Comment } from '../../project/models/Comment.model';
import { env } from '../../../config/env.config';
import AppError from '../../../utils/appError';
import { uploadDocument, getSignedUrl } from '../../../utils/cloudinary.util';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const exchangePortalToken = async (clientId: string, token: string) => {
    const client = await Client.findOne({
        _id: new Types.ObjectId(clientId),
        portalEnabled: true,
        portalToken: token,
    }).lean();

    if (!client) throw new AppError('Invalid or revoked access link. Please contact your account manager.', 401);

    const jwt_token = jwt.sign(
        {
            type: 'client-portal',
            clientId: (client._id as any).toString(),
            email: client.email,
            name: client.name,
        },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '90d' }
    );

    return {
        jwt_token,
        client: {
            clientId: (client._id as any).toString(),
            name: client.name,
            email: client.email,
            companyName: client.companyName,
        },
    };
};

// ─── Client Info ──────────────────────────────────────────────────────────────

export const getPortalClientInfo = async (clientId: string) => {
    const client = await Client.findById(clientId).select('name email companyName phone address').lean();
    if (!client) throw new AppError('Client not found', 404);
    return client;
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export const getPortalProjects = async (clientId: string) => {
    const projects = await Project.find({ clientId: new Types.ObjectId(clientId), isArchived: false })
        .select('name description status priority startDate endDate deadline budget currency billingType')
        .sort({ updatedAt: -1 })
        .lean();
    return projects;
};

export const getPortalProject = async (clientId: string, projectId: string) => {
    const project = await Project.findOne({
        _id: new Types.ObjectId(projectId),
        clientId: new Types.ObjectId(clientId),
        isArchived: false,
    })
        .select('name description status priority startDate endDate deadline budget currency billingType phases invoiceDetails')
        .lean();

    if (!project) throw new AppError('Project not found', 404);
    return project;
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const getPortalTasks = async (clientId: string, projectId: string, status?: string) => {
    await assertProjectOwnership(clientId, projectId);

    const query: any = { projectId: new Types.ObjectId(projectId) };
    if (status) query.status = status;

    const tasks = await Task.find(query)
        .select('title description status priority startDate endDate deadline estimatedHours parentTaskId')
        .sort({ createdAt: -1 })
        .lean();

    return tasks;
};

// ─── Meetings ─────────────────────────────────────────────────────────────────

export const getPortalMeetings = async (clientId: string, projectId: string) => {
    await assertProjectOwnership(clientId, projectId);

    const meetings = await Meeting.find({
        projectId: new Types.ObjectId(projectId),
        type: 'external',              // Only external meetings visible to client
    })
        .select('title description scheduledAt duration location agenda notes actionItems')
        .sort({ scheduledAt: -1 })
        .lean();

    return meetings;
};

// ─── Credentials ──────────────────────────────────────────────────────────────

export const getPortalCredentials = async (clientId: string, projectId: string) => {
    await assertProjectOwnership(clientId, projectId);

    const credentials = await Credential.find({ projectId: new Types.ObjectId(projectId) })
        .sort({ createdAt: -1 });

    // Decrypt each credential before returning
    return credentials.map((cred) => {
        const plain = cred.toObject();
        try {
            plain.credentials = cred.decryptCredentials();
        } catch {
            // If decryption fails (e.g. key rotation), return masked
            plain.credentials = {};
        }
        return plain;
    });
};

// ─── Documents (Shared Files folder only) ─────────────────────────────────────

export const getPortalDocuments = async (clientId: string, projectId: string) => {
    await assertProjectOwnership(clientId, projectId);

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

export const uploadPortalDocument = async (
    clientId: string,
    projectId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number
) => {
    await assertProjectOwnership(clientId, projectId);
    const sharedFolder = await getSharedFolder(projectId);

    const cloudFolder = `projects/${projectId}/docs/${sharedFolder._id.toString()}/client`;
    const uploadResult = await uploadDocument(fileBuffer, cloudFolder, fileName);

    const item = await DocItem.create({
        projectId: new Types.ObjectId(projectId),
        folderId: sharedFolder._id,
        name: fileName,
        cloudinaryId: uploadResult.cloudinaryId,
        size: uploadResult.size || fileSize,
        mimeType,
        uploadedBy: new Types.ObjectId(clientId), // clientId used as reference — portal upload
        viewAccess: [],
    });

    return item;
};

export const getPortalDocumentUrl = async (clientId: string, projectId: string, itemId: string) => {
    await assertProjectOwnership(clientId, projectId);
    const item = await DocItem.findById(itemId).lean();
    if (!item) throw new AppError('File not found', 404);
    return getSignedUrl(item.cloudinaryId, 3600);
};

// ─── Comments ─────────────────────────────────────────────────────────────────

export const getComments = async (
    clientId: string,
    projectId: string,
    entityType: 'task' | 'meeting',
    entityId: string
) => {
    await assertProjectOwnership(clientId, projectId);

    const comments = await Comment.find({
        projectId: new Types.ObjectId(projectId),
        entityType,
        entityId: new Types.ObjectId(entityId),
    })
        .sort({ createdAt: 1 })
        .lean();

    return comments;
};

export const addClientComment = async (
    clientId: string,
    projectId: string,
    entityType: 'task' | 'meeting',
    entityId: string,
    content: string,
    authorName: string
) => {
    await assertProjectOwnership(clientId, projectId);

    const comment = await Comment.create({
        projectId: new Types.ObjectId(projectId),
        entityType,
        entityId: new Types.ObjectId(entityId),
        content: content.trim(),
        authorType: 'client',
        clientId: new Types.ObjectId(clientId),
        authorName,
    });

    return comment;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertProjectOwnership(clientId: string, projectId: string): Promise<void> {
    const project = await Project.findOne({
        _id: new Types.ObjectId(projectId),
        clientId: new Types.ObjectId(clientId),
        isArchived: false,
    })
        .select('_id')
        .lean();

    if (!project) throw new AppError('Project not found', 404);
}

async function getSharedFolder(projectId: string) {
    const existing = await DocFolder.findOne({
        projectId: new Types.ObjectId(projectId),
        isClientShared: true,
        isSystem: true,
    }).lean();

    if (existing) return existing;

    // Auto-create for projects that pre-date the Shared Files feature
    const project = await Project.findById(projectId).select('createdBy').lean();
    if (!project) throw new AppError('Project not found', 404);

    const created = await DocFolder.create({
        projectId: new Types.ObjectId(projectId),
        name: 'Shared Files',
        parentId: null,
        createdBy: project.createdBy,
        viewAccess: [],
        isSystem: true,
        isClientShared: true,
    });

    return created.toObject() as typeof existing & NonNullable<typeof existing>;
}
