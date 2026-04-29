import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project.model';
import { Task } from '../models/Task.model';
import { DocFolder } from '../models/DocFolder.model';
import { User } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import { Employee } from '../../hrms/models/Employee.model';
import { Partner } from '../../partners/models/Partner.model';
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
        employeeId?: string;
        partnerEmployeeId?: string;
        partnerId?: string;
        userId?: string;
        memberType: 'employee' | 'partner-employee' | 'partner';
        role: 'admin' | 'manager' | 'developer' | 'designer' | 'qa' | 'viewer' | 'member';
        subModules?: {
            overview: boolean;
            tasks: boolean;
            timeLogs: boolean;
            meetings: boolean;
            credentials: boolean;
            documents: boolean;
            notes: boolean;
        };
    }>;
    partnerId?: string;
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
        overview: true, tasks: true, timeLogs: true,
        meetings: true, credentials: true, documents: true, notes: true,
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

function serializeAssignee(assignee: any) {
    const employee = assignee?.employeeId && typeof assignee.employeeId === 'object' ? assignee.employeeId : null;
    const partnerEmployee = assignee?.partnerEmployeeId && typeof assignee.partnerEmployeeId === 'object'
        ? assignee.partnerEmployeeId
        : null;
    const partner = assignee?.partnerId && typeof assignee.partnerId === 'object' ? assignee.partnerId : null;
    const employeeUser = employee?.userId && typeof employee.userId === 'object' ? employee.userId : null;
    const plainUser = assignee?.userId && typeof assignee.userId === 'object' ? assignee.userId : null;
    const normalizedUserRole = String((plainUser as any)?.role?.name || (plainUser as any)?.role || '').toLowerCase();
    const isProtected = assignee?.memberType === 'partner' || ['super-admin', 'super_admin'].includes(normalizedUserRole);

    if (assignee?.memberType === 'partner' || partner) {
        const partnerUser = partner?.userId && typeof partner.userId === 'object' ? partner.userId : null;

        return {
            ...assignee,
            memberId: partner?._id?.toString() || assignee?.partnerId?.toString?.() || plainUser?._id?.toString?.() || assignee?.userId?.toString?.() || '',
            displayName: partnerUser?.name || partner?.contactPerson || partner?.companyName || 'Partner',
            displayEmail: partnerUser?.email || partner?.email || '',
            displayDesignation: 'Partner Admin',
            displayCode: 'Partner',
            sourceType: 'partner',
            sourceLabel: 'Partner',
            protectedFromRemoval: isProtected,
        };
    }

    if (assignee?.memberType === 'partner-employee' || partnerEmployee) {
        return {
            ...assignee,
            memberId: partnerEmployee?._id?.toString() || assignee?.partnerEmployeeId?.toString?.() || '',
            displayName: partnerEmployee?.name || 'Partner Team Member',
            displayEmail: partnerEmployee?.email || '',
            displayDesignation: partnerEmployee?.designation || '',
            displayCode: 'Partner',
            sourceType: 'partner',
            sourceLabel: 'Partner Team',
            protectedFromRemoval: isProtected,
        };
    }

    return {
        ...assignee,
        memberId: employee?._id?.toString() || assignee?.employeeId?.toString?.() || plainUser?._id?.toString?.() || assignee?.userId?.toString?.() || '',
        displayName: employeeUser?.name || plainUser?.name || 'Creative Upaay Member',
        displayEmail: employeeUser?.email || plainUser?.email || '',
        displayDesignation: employee?.designation || '',
        displayCode: 'CU',
        sourceType: 'cu',
        sourceLabel: 'Creative Upaay',
        protectedFromRemoval: isProtected,
    };
}

function serializeProjectAssignees(project: any) {
    if (!project?.assignees) return project;

    return {
        ...project,
        assignees: project.assignees.map((assignee: any) => serializeAssignee(assignee)),
    };
}

async function attachComputedOverdueDate(projects: any | any[]): Promise<any> {
    const arr = Array.isArray(projects) ? projects : [projects];
    if (arr.length === 0) return projects;

    const projectIds = arr
        .map((project) => project?._id?.toString())
        .filter(Boolean);

    if (projectIds.length === 0) return projects;

    const taskDeadlines = await Task.aggregate([
        {
            $match: {
                projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) },
                deadline: { $ne: null },
            },
        },
        {
            $group: {
                _id: '$projectId',
                latestTaskDeadline: { $max: '$deadline' },
            },
        },
    ]);

    const taskDeadlineMap = new Map<string, string>(
        taskDeadlines.map((entry: any) => [entry._id.toString(), entry.latestTaskDeadline?.toISOString?.() || String(entry.latestTaskDeadline)])
    );

    const withOverdueDate = arr.map((project) => {
        const baseDeadline = project?.endDate || project?.deadline || null;
        const latestTaskDeadline = taskDeadlineMap.get(project._id.toString());

        let overdueDate = baseDeadline;
        if (latestTaskDeadline) {
            if (!overdueDate) {
                overdueDate = latestTaskDeadline;
            } else if (new Date(latestTaskDeadline).getTime() > new Date(overdueDate).getTime()) {
                overdueDate = latestTaskDeadline;
            }
        }

        return {
            ...project,
            overdueDate,
        };
    });

    return Array.isArray(projects) ? withOverdueDate : withOverdueDate[0];
}

function normalizeLegacyAssignees(project: any) {
    if (!project?.assignees?.length) return;

    project.assignees.forEach((assignee: any) => {
        if (!assignee.memberType) {
            assignee.memberType = assignee.partnerId ? 'partner' : assignee.partnerEmployeeId ? 'partner-employee' : 'employee';
        }
    });
}

const getSuperadminUserIds = async (): Promise<string[]> => {
    const superadminRoles = await Role.find({
        name: { $in: ['super-admin', 'super_admin', 'superadmin'] },
    }).select('_id').lean();

    if (!superadminRoles.length) {
        return [];
    }

    const superadmins = await User.find({
        role: { $in: superadminRoles.map((role) => role._id) },
        isActive: true,
    }).select('_id').lean();

    if (!superadmins.length) {
        return [];
    }

    const employeeBackedSuperadmins = await Employee.find({
        userId: { $in: superadmins.map((user) => user._id) },
    }).select('userId').lean();

    return employeeBackedSuperadmins.map((employee) => employee.userId.toString());
};

const buildInternalAssignee = async (
    userId: string,
    assignedBy: string,
    role: 'admin' | 'manager' | 'developer' | 'designer' | 'qa' | 'viewer' | 'member',
    isSystemManaged: boolean
) => {
    const employee = await Employee.findOne({ userId }).select('_id userId').lean();

    return {
        ...(employee?._id ? { employeeId: new Types.ObjectId(employee._id.toString()) } : {}),
        memberType: 'employee' as const,
        userId: new Types.ObjectId(userId),
        role,
        isSystemManaged,
        assignedBy: new Types.ObjectId(assignedBy),
        assignedAt: new Date(),
    };
};

/**
 * Create a new project
 */
export const createProject = async (
    data: CreateProjectData
): Promise<IProject> => {
    const initialAssignees = data.assignees?.map((a) => ({
        ...a,
        assignedBy: data.createdBy,
        assignedAt: new Date(),
    })) || [];

    const seenUserIds = new Set(
        initialAssignees
            .map((assignee) => assignee.userId?.toString())
            .filter(Boolean)
    );

    const pushUniqueAssignee = (assignee: any) => {
        const assigneeUserId = assignee.userId?.toString();
        if (assigneeUserId && seenUserIds.has(assigneeUserId)) {
            return;
        }

        if (assigneeUserId) {
            seenUserIds.add(assigneeUserId);
        }

        initialAssignees.push(assignee);
    };

    pushUniqueAssignee(await buildInternalAssignee(data.createdBy, data.createdBy, 'admin', false));

    const superadminUserIds = await getSuperadminUserIds();
    for (const superadminUserId of superadminUserIds) {
        pushUniqueAssignee(await buildInternalAssignee(superadminUserId, data.createdBy, 'admin', true));
    }

    if (data.partnerId) {
        const partner = await Partner.findById(data.partnerId).select('_id userId').lean();
        const partnerUserId = partner?.userId?.toString();

        if (partner && partnerUserId) {
            pushUniqueAssignee({
                partnerId: new Types.ObjectId(partner._id.toString()),
                memberType: 'partner' as const,
                userId: new Types.ObjectId(partnerUserId),
                role: 'admin' as const,
                isSystemManaged: true,
                assignedBy: new Types.ObjectId(data.createdBy),
                assignedAt: new Date(),
            });
        }
    }

    const projectData: any = {
        ...data,
        // Automatically grant the creator full credential-admin access
        credentialAdmins: [new Types.ObjectId(data.createdBy)],
        assignees: initialAssignees,
    };

    const project = await Project.create(projectData);

    // Auto-create the client-shared "Shared Files" folder for every new project
    await DocFolder.create({
        projectId: project._id,
        name: 'Shared Files',
        parentId: null,
        createdBy: new Types.ObjectId(data.createdBy),
        viewAccess: [],
        isSystem: true,
        isClientShared: true,
        isPartnerShared: true,
    });

    // Auto-populate projectPermissions for all initial assignees
    if (data.assignees && data.assignees.length > 0) {
        // Fetch employees to get their userIds
        const employeeIds = data.assignees
            .filter((a) => a.memberType === 'employee' && a.employeeId)
            .map((a) => a.employeeId as string);
        const employees = await Employee.find({ _id: { $in: employeeIds } }).lean();

        const employeeUserMap = new Map(
            employees.map(emp => [emp._id.toString(), (emp.userId as any).toString()])
        );

        await Promise.all(
            data.assignees.map(a => {
                if (a.memberType !== 'employee' || !a.employeeId) {
                    return Promise.resolve();
                }

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
        partnerId?: string;
    },
    projectAccess?: 'all' | 'assigned' | 'custom',
    projectIds?: string[],
    requesterPartnerId?: string,
    requesterIsPartnerEmployee?: boolean
): Promise<IProject[]> => {
    const query: any = { isArchived: false };

    // Apply filters
    if (filters?.status) query.status = filters.status;
    if (filters?.clientId) query.clientId = filters.clientId;
    if (filters?.priority) query.priority = filters.priority;
    if (requesterPartnerId) {
        query.partnerId = new Types.ObjectId(requesterPartnerId);
        if (requesterIsPartnerEmployee) {
            query['assignees.partnerEmployeeId'] = new Types.ObjectId(userId);
        }
    }

    const normalizedRole = userRole?.toLowerCase();
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'super-admin' || normalizedRole === 'super_admin';

    if (!requesterPartnerId && filters?.partnerId && isAdmin) {
        query.partnerId = new Types.ObjectId(filters.partnerId);
    }

    if (!isAdmin && !requesterPartnerId) {
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
            path: 'partnerId',
            select: 'companyName contactPerson userId',
            populate: { path: 'userId', select: 'name email' }
        })
        .populate({
            path: 'assignees.employeeId',
            select: 'designation department',
            populate: { path: 'userId', select: 'name email role' } // Get user info through employee
        })
        .populate('assignees.userId', 'name email role')
        .populate({
            path: 'assignees.partnerId',
            select: 'companyName contactPerson email userId',
            populate: { path: 'userId', select: 'name email role' }
        })
        .populate('assignees.partnerEmployeeId', 'name email designation phone isActive')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();

    const serializedProjects = projects.map((project: any) => serializeProjectAssignees(project));
    return attachComputedOverdueDate(serializedProjects) as any;
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
            path: 'partnerId',
            select: 'companyName contactPerson userId',
            populate: { path: 'userId', select: 'name email' }
        })
        .populate({
            path: 'assignees.employeeId',
            select: 'designation department',
            populate: { path: 'userId', select: 'name email role' }
        })
        .populate('assignees.userId', 'name email role')
        .populate({
            path: 'assignees.partnerId',
            select: 'companyName contactPerson email userId',
            populate: { path: 'userId', select: 'name email role' }
        })
        .populate('assignees.partnerEmployeeId', 'name email designation phone isActive')
        .populate('createdBy', 'name email')
        .populate('documents.uploadedBy', 'name email')
        .lean();

    if (!project) return null;

    const serializedProject = serializeProjectAssignees(project);
    return attachComputedOverdueDate(serializedProject) as any;
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
    memberId: string,
    memberType: 'employee' | 'partner-employee' | 'partner',
    role: 'admin' | 'manager' | 'developer' | 'designer' | 'qa' | 'viewer' | 'member',
    assignedBy: string,
    subModules?: any,
    requesterPartnerId?: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // Older projects may still have assignees from before memberType existed.
    // Normalize them before saving so adding a new member doesn't fail validation.
    normalizeLegacyAssignees(project);

    // Check if employee is already assigned
    const existingAssignee = project.assignees.find((a) => {
        if (memberType === 'partner') {
            return a.partnerId?.toString() === memberId || a.userId?.toString() === memberId;
        }
        if (memberType === 'partner-employee') {
            return a.partnerEmployeeId?.toString() === memberId;
        }

        return a.employeeId?.toString() === memberId;
    });

    if (existingAssignee) {
        throw new AppError('Employee is already assigned to this project', 400);
    }

    if (memberType === 'partner-employee') {
        const { PartnerEmployee } = await import('../../partners/models/PartnerEmployee.model');
        const partnerEmployee = await PartnerEmployee.findById(memberId);

        if (!partnerEmployee) {
            throw new AppError('Partner team member not found', 404);
        }

        if (!partnerEmployee.isActive) {
            throw new AppError('This partner team member is inactive', 400);
        }

        const projectPartnerId = project.partnerId?.toString();
        if (!projectPartnerId || projectPartnerId !== partnerEmployee.partnerId.toString()) {
            throw new AppError('Partner team members can only be added to their own partner projects', 400);
        }

        if (requesterPartnerId && requesterPartnerId !== partnerEmployee.partnerId.toString()) {
            throw new AppError('You can only add your own team members to this project', 403);
        }

        project.assignees.push({
            partnerEmployeeId: new Types.ObjectId(memberId),
            memberType,
            userId: new Types.ObjectId(memberId),
            role,
            assignedBy: new Types.ObjectId(assignedBy),
            assignedAt: new Date(),
        });
    } else {
        const employee = await Employee.findById(memberId);
        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        project.assignees.push({
            employeeId: new Types.ObjectId(memberId),
            memberType,
            userId: new Types.ObjectId((employee.userId as any).toString()),
            role,
            assignedBy: new Types.ObjectId(assignedBy),
            assignedAt: new Date(),
        });

        await ensureProjectInPermissions((employee.userId as any).toString(), projectId, subModules);
    }

    await project.save();

    return getProjectById(projectId) as any;
};

/**
 * Remove assignee from project
 */
export const removeAssignee = async (
    projectId: string,
    memberId: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    normalizeLegacyAssignees(project);

    const assigneeToRemove = project.assignees.find(
        (a) =>
            a.employeeId?.toString() === memberId ||
            a.partnerEmployeeId?.toString() === memberId ||
            a.partnerId?.toString() === memberId ||
            a.userId?.toString() === memberId
    );

    if (assigneeToRemove?.memberType === 'partner' || assigneeToRemove?.isSystemManaged) {
        throw new AppError('This project admin is added automatically and cannot be removed', 403);
    }

    project.assignees = project.assignees.filter(
        (a) =>
            a.employeeId?.toString() !== memberId &&
            a.partnerEmployeeId?.toString() !== memberId &&
            a.partnerId?.toString() !== memberId &&
            a.userId?.toString() !== memberId
    );

    await project.save();

    // Pull the project completely from the user's personal modulePermissions
    // This ensures it is hidden from the user's dashboard
    if (assigneeToRemove?.memberType === 'employee' && assigneeToRemove.employeeId) {
        const employee = await Employee.findById(assigneeToRemove.employeeId);
        if (!employee) {
            return getProjectById(projectId) as any;
        }

        await User.updateOne(
            { _id: employee.userId },
            {
                $pull: {
                    'modulePermissions.projectManagement.projectPermissions': { projectId }
                }
            }
        );

        return getProjectById(projectId) as any;
    }
    return getProjectById(projectId) as any;
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
