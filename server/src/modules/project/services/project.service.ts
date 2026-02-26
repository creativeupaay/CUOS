import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project.model';
import { User } from '../../auth/models/User.model';
import { Employee } from '../../hrms/models/Employee.model';
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
        employeeId: string;
        role: 'manager' | 'developer' | 'designer' | 'qa' | 'viewer';
        subModules?: {
            overview: boolean;
            tasks: boolean;
            timeLogs: boolean;
            meetings: boolean;
            credentials: boolean;
            documents: boolean;
        };
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

// ─── Helper: auto-add project to user's projectPermissions (all tabs false) ──

const defaultProjectPerm = (projectId: string) => ({
    projectId,
    subModules: {
        overview: false, tasks: false, timeLogs: false,
        meetings: false, credentials: false, documents: false,
    },
});

async function ensureProjectInPermissions(userId: string, projectId: string, subModules?: any): Promise<void> {
    const permToInsert = subModules
        ? { projectId, subModules }
        : defaultProjectPerm(projectId);

    // First, ensure projectManagement module is enabled
    await User.updateOne(
        { _id: userId },
        { $set: { 'modulePermissions.projectManagement.enabled': true } }
    );

    // Then add the project to permissions if not already present
    await User.updateOne(
        {
            _id: userId,
            'modulePermissions.projectManagement.projectPermissions.projectId': { $ne: projectId },
        },
        {
            $push: {
                'modulePermissions.projectManagement.projectPermissions': permToInsert,
            },
        }
    );
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

    // Auto-populate projectPermissions for all initial assignees
    if (data.assignees && data.assignees.length > 0) {
        // Fetch employees to get their userIds
        const employeeIds = data.assignees.map(a => a.employeeId);
        const employees = await Employee.find({ _id: { $in: employeeIds } }).lean();

        const employeeUserMap = new Map(
            employees.map(emp => [emp._id.toString(), (emp.userId as any).toString()])
        );

        await Promise.all(
            data.assignees.map(a => {
                const uId = employeeUserMap.get(a.employeeId);
                if (uId) {
                    return ensureProjectInPermissions(uId, (project._id as any).toString(), a.subModules);
                }
                return Promise.resolve();
            })
        );
    }

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
    },
    projectAccess?: 'all' | 'assigned' | 'custom',
    projectIds?: string[]
): Promise<IProject[]> => {
    const query: any = { isArchived: false };

    // Apply filters
    if (filters?.status) query.status = filters.status;
    if (filters?.clientId) query.clientId = filters.clientId;
    if (filters?.priority) query.priority = filters.priority;

    const isAdmin = userRole === 'admin' || userRole === 'super-admin' || userRole === 'super_admin';

    if (!isAdmin) {
        const access = projectAccess ?? 'assigned';
        if (access === 'all') {
            // No restriction — show everything
        } else if (access === 'custom' && projectIds && projectIds.length > 0) {
            // Only the explicitly whitelisted project IDs
            query['_id'] = { $in: projectIds };
        } else {
            // Default 'assigned' — only projects where user's employeeId is an assignee
            const employee = await Employee.findOne({ userId }).lean();
            if (employee) {
                query['assignees.employeeId'] = employee._id;
            } else {
                // Return no projects if user isn't an employee
                query['assignees.employeeId'] = null;
            }
        }
    }

    const projects = await Project.find(query)
        .populate('clientId', 'name email')
        .populate({
            path: 'assignees.employeeId',
            select: 'designation department',
            populate: { path: 'userId', select: 'name email' } // Get user info through employee
        })
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
        .populate({
            path: 'assignees.employeeId',
            select: 'designation department',
            populate: { path: 'userId', select: 'name email role' }
        })
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
    employeeId: string,
    role: 'manager' | 'developer' | 'designer' | 'qa' | 'viewer' | 'member',
    assignedBy: string,
    subModules?: any
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // Check if employee is already assigned
    const existingAssignee = project.assignees.find(
        (a) => a.employeeId.toString() === employeeId
    );

    if (existingAssignee) {
        throw new AppError('Employee is already assigned to this project', 400);
    }

    project.assignees.push({
        employeeId: new Types.ObjectId(employeeId),
        role,
        assignedBy: new Types.ObjectId(assignedBy),
        assignedAt: new Date(),
    });

    await project.save();

    // Auto-add project to the user's projectPermissions
    const employee = await Employee.findById(employeeId);
    if (employee) {
        await ensureProjectInPermissions((employee.userId as any).toString(), projectId, subModules);
    }

    return project;
};

/**
 * Remove assignee from project
 */
export const removeAssignee = async (
    projectId: string,
    employeeId: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    project.assignees = project.assignees.filter(
        (a) => a.employeeId.toString() !== employeeId
    );

    await project.save();

    // Pull the project completely from the user's personal modulePermissions
    // This ensures it is hidden from the user's dashboard
    const employee = await Employee.findById(employeeId);
    if (employee) {
        await User.updateOne(
            { _id: employee.userId },
            {
                $pull: {
                    'modulePermissions.projectManagement.projectPermissions': { projectId }
                }
            }
        );

        return project;
    }
    return project;
};

/**
 * Update assignee permissions (sub modules)
 */
export const updateAssigneePermissions = async (
    employeeId: string,
    projectId: string,
    subModules: any
): Promise<void> => {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new AppError('Employee not found', 404);
    const userId = (employee.userId as any).toString();

    // First ensure the user has the project in their permissions array
    await ensureProjectInPermissions(userId, projectId, subModules);

    // Then update the specific subModules if it was already there
    await User.updateOne(
        {
            _id: userId,
            'modulePermissions.projectManagement.projectPermissions.projectId': projectId
        },
        {
            $set: { 'modulePermissions.projectManagement.projectPermissions.$.subModules': subModules }
        }
    );
};

/**
 * Get assignee permissions (sub modules)
 */
export const getAssigneePermissions = async (
    employeeId: string,
    projectId: string
): Promise<any> => {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new AppError('Employee not found', 404);

    const user = await User.findById(employee.userId);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    const projectPerms = user.modulePermissions?.projectManagement?.projectPermissions || [];
    const perm = projectPerms.find((p: any) => p.projectId.toString() === projectId);

    return perm ? perm.subModules : defaultProjectPerm(projectId).subModules;
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
