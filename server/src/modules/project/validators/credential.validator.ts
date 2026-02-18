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
            email: z.string().email().optional(),

            // Account
            accountId: z.string().optional(),
            apiKey: z.string().optional(),
            apiSecret: z.string().optional(),

            // 2FA
            totpSecret: z.string().optional(),
            backupCodes: z.array(z.string()).optional(),

            // Generic
            url: z.string().url().optional(),
            notes: z.string().optional(),
        }),

        accessUsers: z.array(z.string()).min(1, 'At least one access user is required'),
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
            email: z.string().email().optional(),
            accountId: z.string().optional(),
            apiKey: z.string().optional(),
            apiSecret: z.string().optional(),
            totpSecret: z.string().optional(),
            backupCodes: z.array(z.string()).optional(),
            url: z.string().url().optional(),
            notes: z.string().optional(),
        }).optional(),

        accessUsers: z.array(z.string()).optional(),
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
