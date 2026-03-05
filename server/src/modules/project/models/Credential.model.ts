import mongoose, { Schema, Document, Types } from 'mongoose';
import { encrypt, decrypt } from '../../../utils/encryption.util';

export interface ICredentialData {
    // For env variables
    envKey?: string;
    envValue?: string; // ENCRYPTED

    // For SSH keys
    sshPublicKey?: string;
    sshPrivateKey?: string; // ENCRYPTED
    sshPassphrase?: string; // ENCRYPTED

    // For test users
    username?: string;
    password?: string; // ENCRYPTED
    email?: string;

    // For accounts
    accountId?: string;
    apiKey?: string; // ENCRYPTED
    apiSecret?: string; // ENCRYPTED

    // For 2FA
    totpSecret?: string; // ENCRYPTED
    backupCodes?: string[]; // ENCRYPTED

    // Generic fields
    url?: string;
    notes?: string; // ENCRYPTED
}

export interface ICredential extends Document {
    _id: Types.ObjectId;
    name: string;
    type: 'env' | 'ssh-key' | 'test-user' | 'account' | '2fa' | 'other';
    description?: string;

    projectId: Types.ObjectId;

    credentials: ICredentialData;

    /**
     * Users with view-only access to this credential.
     * Edit/admin access is managed via project.credentialAdmins.
     */
    viewAccess: Types.ObjectId[];

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    lastAccessedAt?: Date;
    lastAccessedBy?: Types.ObjectId;

    // Methods
    decryptCredentials(): ICredentialData;
}

const CredentialDataSchema = new Schema<ICredentialData>(
    {
        // Env
        envKey: String,
        envValue: String, // Will be encrypted

        // SSH
        sshPublicKey: String,
        sshPrivateKey: String, // Will be encrypted
        sshPassphrase: String, // Will be encrypted

        // Test User
        username: String,
        password: String, // Will be encrypted
        email: String,

        // Account
        accountId: String,
        apiKey: String, // Will be encrypted
        apiSecret: String, // Will be encrypted

        // 2FA
        totpSecret: String, // Will be encrypted
        backupCodes: [String], // Will be encrypted

        // Generic
        url: String,
        notes: String, // Will be encrypted
    },
    { _id: false }
);

const CredentialSchema = new Schema<ICredential>(
    {
        name: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ['env', 'ssh-key', 'test-user', 'account', '2fa', 'other'],
            required: true,
        },
        description: { type: String, trim: true },

        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },

        credentials: { type: CredentialDataSchema, required: true },

        viewAccess: [{ type: Schema.Types.ObjectId, ref: 'User' }],

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        lastAccessedAt: Date,
        lastAccessedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
    }
);

// Indexes for performance
CredentialSchema.index({ projectId: 1 });
CredentialSchema.index({ type: 1 });
CredentialSchema.index({ viewAccess: 1 });

// Pre-save hook to encrypt sensitive fields
CredentialSchema.pre('save', function (next) {
    if (this.isModified('credentials')) {
        const creds = this.credentials;

        // Encrypt sensitive fields
        if (creds.envValue) creds.envValue = encrypt(creds.envValue);
        if (creds.sshPrivateKey) creds.sshPrivateKey = encrypt(creds.sshPrivateKey);
        if (creds.sshPassphrase) creds.sshPassphrase = encrypt(creds.sshPassphrase);
        if (creds.password) creds.password = encrypt(creds.password);
        if (creds.apiKey) creds.apiKey = encrypt(creds.apiKey);
        if (creds.apiSecret) creds.apiSecret = encrypt(creds.apiSecret);
        if (creds.totpSecret) creds.totpSecret = encrypt(creds.totpSecret);
        if (creds.backupCodes) {
            creds.backupCodes = creds.backupCodes.map((code) => encrypt(code));
        }
        if (creds.notes) creds.notes = encrypt(creds.notes);
    }

    next();
});

// Method to decrypt credentials
CredentialSchema.methods.decryptCredentials = function (): ICredentialData {
    const creds = this.credentials.toObject();

    // Decrypt sensitive fields
    if (creds.envValue) creds.envValue = decrypt(creds.envValue);
    if (creds.sshPrivateKey) creds.sshPrivateKey = decrypt(creds.sshPrivateKey);
    if (creds.sshPassphrase) creds.sshPassphrase = decrypt(creds.sshPassphrase);
    if (creds.password) creds.password = decrypt(creds.password);
    if (creds.apiKey) creds.apiKey = decrypt(creds.apiKey);
    if (creds.apiSecret) creds.apiSecret = decrypt(creds.apiSecret);
    if (creds.totpSecret) creds.totpSecret = decrypt(creds.totpSecret);
    if (creds.backupCodes) {
        creds.backupCodes = creds.backupCodes.map((code: string) => decrypt(code));
    }
    if (creds.notes) creds.notes = decrypt(creds.notes);

    return creds;
};

export const Credential = mongoose.model<ICredential>('Credential', CredentialSchema);
