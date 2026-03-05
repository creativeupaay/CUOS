import { z } from 'zod';

export const createCredentialSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    body: z.object({
        name: z.string().min(1, 'Credential name is required').trim(),
        type: z.enum(['env', 'ssh-key', 'test-user', 'account', '2fa', 'other']),
        description: z.string().optional(),

        credentials: z.object({
            // Env
            envKey: z.string().optional(),
            envValue: z.string().optional(),

            // SSH
            sshPublicKey: z.string().optional(),
            sshPrivateKey: z.string().optional(),
            sshPassphrase: z.string().optional(),

            // Test User
            username: z.string().optional(),
            password: z.string().optional(),
            email: z.string().email().optional().or(z.literal('')),

            // Account
            accountId: z.string().optional(),
            apiKey: z.string().optional(),
            apiSecret: z.string().optional(),

            // 2FA
            totpSecret: z.string().optional(),
            backupCodes: z.array(z.string()).optional(),

            // Generic
            url: z.string().optional(),
            notes: z.string().optional(),
        }),
    }),
});

export const updateCredentialSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        id: z.string().min(1, 'Credential ID is required'),
    }),
    body: z.object({
        name: z.string().min(1).trim().optional(),
        description: z.string().optional(),

        credentials: z.object({
            envKey: z.string().optional(),
            envValue: z.string().optional(),
            sshPublicKey: z.string().optional(),
            sshPrivateKey: z.string().optional(),
            sshPassphrase: z.string().optional(),
            username: z.string().optional(),
            password: z.string().optional(),
            email: z.string().email().optional().or(z.literal('')),
            accountId: z.string().optional(),
            apiKey: z.string().optional(),
            apiSecret: z.string().optional(),
            totpSecret: z.string().optional(),
            backupCodes: z.array(z.string()).optional(),
            url: z.string().optional(),
            notes: z.string().optional(),
        }).optional(),
    }),
});

export const getCredentialsSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    query: z.object({
        type: z.enum(['env', 'ssh-key', 'test-user', 'account', '2fa', 'other']).optional(),
    }).optional(),
});

export const getCredentialByIdSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        id: z.string().min(1, 'Credential ID is required'),
    }),
});

export const deleteCredentialSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        id: z.string().min(1, 'Credential ID is required'),
    }),
});

/** POST /:projectId/credentials/share */
export const shareCredentialsSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    body: z.object({
        credentialIds: z.array(z.string().min(1)).min(1, 'Select at least one credential'),
        userIds: z.array(z.string().min(1)).min(1, 'Select at least one user'),
    }),
});

/** DELETE /:projectId/credentials/share (revoke) */
export const revokeCredentialAccessSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    body: z.object({
        credentialIds: z.array(z.string().min(1)).min(1, 'Select at least one credential'),
        userIds: z.array(z.string().min(1)).min(1, 'Select at least one user'),
    }),
});

/** PATCH /:projectId/credential-admins */
export const updateCredentialAdminsSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    body: z.object({
        userIds: z.array(z.string()).default([]),
    }),
});

/** GET /:projectId/credential-admins */
export const getCredentialAdminsSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
});
