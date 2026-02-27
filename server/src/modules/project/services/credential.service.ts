import { Credential, ICredential } from '../models/Credential.model';
import AppError from '../../../utils/appError';

export interface CreateCredentialData {
    name: string;
    type: 'env' | 'ssh-key' | 'test-user' | 'account' | '2fa' | 'other';
    description?: string;
    projectId: string;
    credentials: any;
    accessUsers: string[];
    createdBy: string;
}

export interface UpdateCredentialData {
    name?: string;
    description?: string;
    credentials?: any;
    accessUsers?: string[];
}

export const createCredential = async (
    data: CreateCredentialData
): Promise<ICredential> => {
    const credential = await Credential.create(data);
    return credential;
};

export const getCredentials = async (
    projectId: string,
    userId: string,
    userRole: string,
    filters?: { type?: string }
): Promise<ICredential[]> => {
    const query: any = { projectId };

    if (filters?.type) query.type = filters.type;

    let credentials = await Credential.find(query)
        .populate('accessUsers', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    // Filter by access (if not admin)
    if (userRole !== 'admin' && userRole !== 'super-admin') {
        credentials = credentials.filter((cred) =>
            cred.accessUsers.some((u: any) => (u._id || u).toString() === userId)
        );
    }

    return credentials;
};

export const getCredentialById = async (
    credentialId: string
): Promise<ICredential | null> => {
    const credential = await Credential.findById(credentialId)
        .populate('accessUsers', 'name email role')
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
        // Update last accessed info
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
