import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project.model';
import AppError from '../../../utils/appError';
import {
    uploadDocument,
    getSignedUrl,
    deleteDocument,
} from '../../../utils/cloudinary.util';

export interface CreateProjectData {
    name: string;
    description?: string;
    status?: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    clientId: string;
    startDate: Date;
    endDate?: Date;
    deadline?: Date;
    budget?: number;
    currency?: string;
    billingType?: 'fixed' | 'hourly' | 'milestone';
    hourlyRate?: number;
    invoiceDetails?: any;
    assignees?: Array<{
        userId: string;
        role: 'manager' | 'developer' | 'designer' | 'qa' | 'viewer';
    }>;
    createdBy: string;
}

export interface UpdateProjectData {
    name?: string;
    description?: string;
    status?: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    startDate?: Date;
    endDate?: Date;
    deadline?: Date;
    budget?: number;
    currency?: string;
    billingType?: 'fixed' | 'hourly' | 'milestone';
    hourlyRate?: number;
    invoiceDetails?: any;
}

/**
 * Create a new project
 */
export const createProject = async (
    data: CreateProjectData
): Promise<IProject> => {
    const projectData: any = {
        ...data,
        assignees: data.assignees?.map((a) => ({
            ...a,
            assignedBy: data.createdBy,
            assignedAt: new Date(),
        })),
    };

    const project = await Project.create(projectData);
    return project;
};

/**
 * Get all projects (filtered by user access)
 */
export const getProjects = async (
    userId: string,
    userRole: string,
    filters?: {
        status?: string;
        clientId?: string;
        priority?: string;
    }
): Promise<IProject[]> => {
    const query: any = { isArchived: false };

    // Apply filters
    if (filters?.status) query.status = filters.status;
    if (filters?.clientId) query.clientId = filters.clientId;
    if (filters?.priority) query.priority = filters.priority;

    // If not admin, filter by assigned projects
    if (userRole !== 'admin' && userRole !== 'super-admin') {
        query['assignees.userId'] = userId;
    }

    const projects = await Project.find(query)
        .populate('clientId', 'name email')
        .populate('assignees.userId', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    return projects;
};

/**
 * Get project by ID
 */
export const getProjectById = async (
    projectId: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId)
        .populate('clientId', 'name email phone')
        .populate('assignees.userId', 'name email role')
        .populate('createdBy', 'name email')
        .populate('documents.uploadedBy', 'name email');

    return project;
};

/**
 * Update project
 */
export const updateProject = async (
    projectId: string,
    data: UpdateProjectData
): Promise<IProject | null> => {
    const project = await Project.findByIdAndUpdate(
        projectId,
        { $set: data },
        { new: true, runValidators: true }
    );

    return project;
};

/**
 * Delete project (soft delete)
 */
export const deleteProject = async (
    projectId: string
): Promise<IProject | null> => {
    const project = await Project.findByIdAndUpdate(
        projectId,
        { $set: { isArchived: true } },
        { new: true }
    );

    return project;
};

/**
 * Add assignee to project
 */
export const addAssignee = async (
    projectId: string,
    userId: string,
    role: 'manager' | 'developer' | 'designer' | 'qa' | 'viewer',
    assignedBy: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // Check if user is already assigned
    const existingAssignee = project.assignees.find(
        (a) => a.userId.toString() === userId
    );

    if (existingAssignee) {
        throw new AppError('User is already assigned to this project', 400);
    }

    project.assignees.push({
        userId: new Types.ObjectId(userId),
        role,
        assignedBy: new Types.ObjectId(assignedBy),
        assignedAt: new Date(),
    });

    await project.save();
    return project;
};

/**
 * Remove assignee from project
 */
export const removeAssignee = async (
    projectId: string,
    userId: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    project.assignees = project.assignees.filter(
        (a) => a.userId.toString() !== userId
    );

    await project.save();
    return project;
};

/**
 * Upload document to project
 */
export const uploadProjectDocument = async (
    projectId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    documentType: 'contract' | 'proposal' | 'invoice' | 'other',
    uploadedBy: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // Upload to Cloudinary
    const folder = `projects/${projectId}/documents`;
    const uploadResult = await uploadDocument(fileBuffer, folder, fileName);

    // Add document to project
    project.documents.push({
        _id: new Types.ObjectId(),
        name: fileName,
        type: documentType,
        cloudinaryId: uploadResult.cloudinaryId,
        uploadedBy: new Types.ObjectId(uploadedBy),
        uploadedAt: new Date(),
        size: uploadResult.size,
    });

    await project.save();
    return project;
};

/**
 * Get signed URL for document
 */
export const getProjectDocument = async (
    projectId: string,
    documentId: string
): Promise<string> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    const document = project.documents.find(
        (doc) => doc._id.toString() === documentId
    );

    if (!document) {
        throw new AppError('Document not found', 404);
    }

    // Generate signed URL (expires in 1 hour)
    const signedUrl = getSignedUrl(document.cloudinaryId, 3600);
    return signedUrl;
};

/**
 * Delete document from project
 */
export const deleteProjectDocument = async (
    projectId: string,
    documentId: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    const document = project.documents.find(
        (doc) => doc._id.toString() === documentId
    );

    if (!document) {
        throw new AppError('Document not found', 404);
    }

    // Delete from Cloudinary
    await deleteDocument(document.cloudinaryId);

    // Remove from project
    project.documents = project.documents.filter(
        (doc) => doc._id.toString() !== documentId
    );

    await project.save();
    return project;
};
