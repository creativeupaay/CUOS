import { Types } from 'mongoose';
import { Credential, ICredential } from '../models/Credential.model';
import { Project } from '../models/Project.model';
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
    if (userRole === 'admin' || userRole === 'super-admin' || userRole === 'super_admin') {
        return true;
    }
    const project = await Project.findById(projectId).select('credentialAdmins');
    if (!project) return false;
    return project.credentialAdmins.some((id) => id.toString() === userId);
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
 */
export const shareViewAccess = async (
    projectId: string,
    credentialIds: string[],
    userIds: string[]
): Promise<void> => {
    if (!credentialIds.length || !userIds.length) return;

    const userObjectIds = userIds.map((id) => new Types.ObjectId(id));

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

    for (const userId of userIds) {
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
 */
export const revokeViewAccess = async (
    projectId: string,
    credentialIds: string[],
    userIds: string[]
): Promise<void> => {
    if (!credentialIds.length || !userIds.length) return;

    const userObjectIds = userIds.map((id) => new Types.ObjectId(id));

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
 */
export const updateCredentialAdmins = async (
    projectId: string,
    userIds: string[]
): Promise<void> => {
    const userObjectIds = userIds.map((id) => new Types.ObjectId(id));
    await Project.findByIdAndUpdate(
        projectId,
        { $set: { credentialAdmins: userObjectIds } },
        { new: true }
    );
};

/**
 * Get the credential admins of a project.
 */
export const getCredentialAdmins = async (
    projectId: string
): Promise<any[]> => {
    const project = await Project.findById(projectId)
        .select('credentialAdmins')
        .populate('credentialAdmins', 'name email');
    return project?.credentialAdmins ?? [];
};
