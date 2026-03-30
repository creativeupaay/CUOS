import { Types } from 'mongoose';
import { Credential, ICredential } from '../models/Credential.model';
import { Project } from '../models/Project.model';
import { Employee } from '../../hrms/models/Employee.model';
import AppError from '../../../utils/appError';
import { notificationService } from '../../notification/services/notification.service';

export interface CreateCredentialData {
    name: string;
    type: 'env' | 'ssh-key' | 'test-user' | 'account' | '2fa' | 'other';
    description?: string;
    projectId: string;
    credentials: any;
    createdBy: string;
}

export interface UpdateCredentialData {
    name?: string;
    description?: string;
    credentials?: any;
}

/**
 * Check if a user has credential-admin access to a project.
 * Returns true for super-admins, or if the user is in project.credentialAdmins.
 */
export const isCredentialAdmin = async (
    projectId: string,
    userId: string,
    userRole: string
): Promise<boolean> => {
    // Role-based access (super-admin/admin always have access)
    if (userRole === 'admin' || userRole === 'super-admin' || userRole === 'super_admin') {
        return true;
    }

    const project = await Project.findById(projectId).select('credentialAdmins');
    if (!project) return false;

    const credentialAdmins = project.credentialAdmins ?? [];
    const normalizedUserId = userId.toString().trim();

    const isAdmin = credentialAdmins.some((id) => id.toString().trim() === normalizedUserId);

    // Debug logging (remove in production if needed)
    console.log('[isCredentialAdmin] Debug Info:', {
        projectId,
        userId: normalizedUserId,
        userRole,
        credentialAdmins: credentialAdmins.map(id => id.toString()),
        isAdmin,
    });

    return isAdmin;
};

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

export const createCredential = async (
    data: CreateCredentialData
): Promise<ICredential> => {
    const credential = await Credential.create({
        ...data,
        viewAccess: [], // view access is managed separately via shareCredentials
    });
    return credential;
};

export const getCredentials = async (
    projectId: string,
    userId: string,
    userRole: string,
    filters?: { type?: string }
): Promise<ICredential[]> => {
    const isAdmin = await isCredentialAdmin(projectId, userId, userRole);

    const query: any = { projectId };
    if (filters?.type) query.type = filters.type;

    // For non-admins, show credentials they created OR have been granted access to
    if (!isAdmin) {
        const userObjectId = new Types.ObjectId(userId);
        query.$or = [
            { createdBy: userObjectId },           // Credentials they created
            { viewAccess: userObjectId },          // Credentials shared with them
        ];
    }

    const credentials = await Credential.find(query)
        .populate('viewAccess', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    return credentials;
};


export const getCredentialById = async (
    credentialId: string
): Promise<ICredential | null> => {
    const credential = await Credential.findById(credentialId)
        .populate('viewAccess', 'name email role')
        .populate('createdBy', 'name email');

    return credential;
};

export const updateCredential = async (
    credentialId: string,
    data: UpdateCredentialData,
    userId: string
): Promise<ICredential | null> => {
    const credential = await Credential.findByIdAndUpdate(
        credentialId,
        { $set: data },
        { new: true, runValidators: true }
    );

    if (credential) {
        credential.lastAccessedAt = new Date();
        credential.lastAccessedBy = userId as any;
        await credential.save();
    }

    return credential;
};

export const deleteCredential = async (credentialId: string): Promise<void> => {
    await Credential.findByIdAndDelete(credentialId);
};

export const logCredentialAccess = async (
    credentialId: string,
    userId: string
): Promise<void> => {
    await Credential.findByIdAndUpdate(credentialId, {
        $set: {
            lastAccessedAt: new Date(),
            lastAccessedBy: userId,
        },
    });
};

/**
 * Share specific credentials with specific users (view access).
 * Adds userIds to viewAccess of each credential (idempotent — uses $addToSet).
 * Accepts both Employee IDs and User IDs, converts to User IDs before storing.
 */
export const shareViewAccess = async (
    projectId: string,
    credentialIds: string[],
    userIds: string[]
): Promise<void> => {
    if (!credentialIds.length || !userIds.length) return;

    // Convert Employee IDs to User IDs if needed
    const actualUserIds = await convertToUserIds(userIds);
    const userObjectIds = actualUserIds.map((id) => new Types.ObjectId(id));

    await Credential.updateMany(
        {
            _id: { $in: credentialIds.map((id) => new Types.ObjectId(id)) },
            projectId: new Types.ObjectId(projectId),
        },
        {
            $addToSet: { viewAccess: { $each: userObjectIds } },
        }
    );

    // Notify users about credential access
    const project = await Project.findById(projectId).select('name').lean();
    const projectName = project?.name || 'a project';

    for (const userId of actualUserIds) {
        notificationService.createNotification({
            userId,
            type: 'credential_access_granted',
            title: 'Credential Access Granted',
            message: `You have been granted access to ${credentialIds.length} credential(s) in ${projectName}.`,
            link: `/projects/${projectId}?tab=credentials`,
            metadata: {
                projectId,
                credentialIds,
            },
        });
    }
};

/**
 * Revoke view access for specific users from specific credentials.
 * Accepts both Employee IDs and User IDs, converts to User IDs before revoking.
 */
export const revokeViewAccess = async (
    projectId: string,
    credentialIds: string[],
    userIds: string[]
): Promise<void> => {
    if (!credentialIds.length || !userIds.length) return;

    // Convert Employee IDs to User IDs if needed
    const actualUserIds = await convertToUserIds(userIds);
    const userObjectIds = actualUserIds.map((id) => new Types.ObjectId(id));

    await Credential.updateMany(
        {
            _id: { $in: credentialIds.map((id) => new Types.ObjectId(id)) },
            projectId: new Types.ObjectId(projectId),
        },
        {
            $pullAll: { viewAccess: userObjectIds },
        }
    );
};

/**
 * Set the credentialAdmins on a project.
 * This replaces the entire list — super-admin only.
 * Accepts both Employee IDs and User IDs, converts to User IDs before storing.
 */
export const updateCredentialAdmins = async (
    projectId: string,
    userIds: string[]
): Promise<void> => {
    // Convert Employee IDs to User IDs if needed
    const actualUserIds = await convertToUserIds(userIds);
    const userObjectIds = actualUserIds.map((id) => new Types.ObjectId(id));

    await Project.findByIdAndUpdate(
        projectId,
        { $set: { credentialAdmins: userObjectIds } },
        { new: true }
    );
};

/**
 * Convert User IDs back to Employee information for frontend display.
 * This allows the frontend to show correct selections in admin management UI.
 */
const convertToEmployeeData = async (userIds: Types.ObjectId[]): Promise<any[]> => {
    if (userIds.length === 0) return [];

    console.log('[credential convertToEmployeeData] Input User IDs:', userIds.map(id => id.toString()));

    // Find employees whose userId matches the stored User IDs
    const employees = await Employee.find({
        userId: { $in: userIds }
    })
    .populate('userId', 'name email')
    .select('_id userId')
    .lean();

    console.log('[credential convertToEmployeeData] Found employees:', employees.length);
    console.log('[credential convertToEmployeeData] Employee details:', employees.map(e => ({
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

    console.log('[credential convertToEmployeeData] Final result:', result);
    return result;
};

/**
 * Get the credential admins of a project.
 * Returns User IDs for frontend admin access checks.
 */
export const getCredentialAdmins = async (
    projectId: string
): Promise<any[]> => {
    const project = await Project.findById(projectId)
        .select('credentialAdmins')
        .lean();

    if (!project?.credentialAdmins?.length) return [];

    // Return User IDs directly for frontend admin checks
    // Frontend expects User IDs to match currentUser._id
    return project.credentialAdmins.map(id => ({ _id: id.toString() }));
};
