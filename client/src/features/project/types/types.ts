// Entity types (internal representation)
export interface ProjectPhase {
    _id?: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed';
    startDate?: string;
    endDate?: string;
}

export interface Project {
    _id: string;
    name: string;
    description?: string;
    status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'critical';

    clientId: string | Client;

    startDate: string;
    endDate?: string;
    deadline?: string;

    budget?: number;
    currency: string;
    billingType: 'fixed' | 'hourly' | 'milestone';
    hourlyRate?: number;

    invoiceDetails?: InvoiceDetails;

    documents: ProjectDocument[];

    assignees: ProjectAssignee[];

    phases?: ProjectPhase[];

    createdBy: string | User;
    createdAt: string;
    updatedAt: string;
    isArchived: boolean;
}

export interface ProjectDocument {
    _id: string;
    name: string;
    type: 'contract' | 'proposal' | 'invoice' | 'other';
    cloudinaryId: string;
    uploadedBy: string | User;
    uploadedAt: string;
    size: number;
}

export interface ProjectAssignee {
    userId: string | User;
    role: 'manager' | 'developer' | 'designer' | 'qa' | 'viewer';
    assignedAt: string;
    assignedBy: string | User;
}

export interface InvoiceDetails {
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceAmount?: number;
    paymentStatus?: 'pending' | 'partial' | 'paid';
    paymentTerms?: string;
}

export interface Task {
    _id: string;
    title: string;
    description?: string;
    status: 'todo' | 'in-progress' | 'completed';
    priority: 'low' | 'medium' | 'high' | 'critical';

    projectId: string | Project;
    parentTaskId?: string | Task;

    startDate?: string;
    endDate?: string;
    deadline?: string;
    estimatedHours?: number;

    assignees: (string | User)[];

    createdBy: string | User;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export interface TimeLog {
    _id: string;
    projectId: string | Project;
    taskId: string | Task;
    userId: string | User;

    date: string;
    duration: number; // in minutes
    startTime?: string;
    endTime?: string;

    description?: string;

    hourlyRate?: number;
    billable: boolean;

    createdAt: string;
    updatedAt: string;
}

export interface Meeting {
    _id: string;
    title: string;
    description?: string;
    type: 'internal' | 'external';

    projectId: string | Project;

    participants: MeetingParticipant[];

    scheduledAt: string;
    duration: number; // in minutes
    location?: string;

    agenda?: string;
    notes?: string;
    actionItems?: MeetingActionItem[];

    accessLevel: 'project-team' | 'managers-only' | 'custom';
    customAccessUsers?: (string | User)[];

    createdBy: string | User;
    createdAt: string;
    updatedAt: string;
}

export interface MeetingParticipant {
    userId?: string | User;
    externalEmail?: string;
    name?: string;
    role?: 'organizer' | 'required' | 'optional';
}

export interface MeetingActionItem {
    _id: string;
    description: string;
    assignedTo?: string | User;
    dueDate?: string;
    completed: boolean;
}

export interface Credential {
    _id: string;
    name: string;
    type: 'env' | 'ssh-key' | 'test-user' | 'account' | '2fa' | 'other';
    description?: string;

    projectId: string | Project;

    credentials: CredentialData;

    accessUsers: (string | User)[];

    createdBy: string | User;
    createdAt: string;
    updatedAt: string;
    lastAccessedAt?: string;
    lastAccessedBy?: string | User;
}

export interface CredentialData {
    // Env
    envKey?: string;
    envValue?: string;

    // SSH
    sshPublicKey?: string;
    sshPrivateKey?: string;
    sshPassphrase?: string;

    // Test User
    username?: string;
    password?: string;
    email?: string;

    // Account
    accountId?: string;
    apiKey?: string;
    apiSecret?: string;

    // 2FA
    totpSecret?: string;
    backupCodes?: string[];

    // Generic
    url?: string;
    notes?: string;
}

// Placeholder types (will be defined in other modules)
export interface Client {
    _id: string;
    name: string;
    email: string;
    phone?: string;
}

export interface User {
    _id: string;
    name: string;
    email: string;
    role: string;
}
