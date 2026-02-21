// API Request/Response types
import type {
    Project,
    Task,
    TimeLog,
    Meeting,
    Credential,
    InvoiceDetails,
    MeetingParticipant,
    MeetingActionItem,
    CredentialData,
    ProjectPhase,
} from './types';

// ============================================
// PROJECT API TYPES
// ============================================

export interface CreateProjectRequest {
    name: string;
    description?: string;
    status?: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    clientId: string;
    startDate: string;
    endDate?: string;
    deadline?: string;
    budget?: number;
    currency?: string;
    billingType?: 'fixed' | 'hourly' | 'milestone';
    hourlyRate?: number;
    invoiceDetails?: InvoiceDetails;
    assignees?: Array<{
        userId: string;
        role: 'manager' | 'developer' | 'designer' | 'qa' | 'viewer';
    }>;
    phases?: Array<Omit<ProjectPhase, '_id'>>;
}

export interface UpdateProjectRequest {
    name?: string;
    description?: string;
    status?: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    startDate?: string;
    endDate?: string;
    deadline?: string;
    budget?: number;
    currency?: string;
    billingType?: 'fixed' | 'hourly' | 'milestone';
    hourlyRate?: number;
    invoiceDetails?: InvoiceDetails;
    phases?: ProjectPhase[];
}

export interface AddAssigneeRequest {
    userId: string;
    role: 'manager' | 'developer' | 'designer' | 'qa' | 'viewer';
}

export interface UploadDocumentRequest {
    file: File;
    name: string;
    type: 'contract' | 'proposal' | 'invoice' | 'other';
}

// ============================================
// TASK API TYPES
// ============================================

export interface CreateTaskRequest {
    title: string;
    description?: string;
    status?: 'todo' | 'in-progress' | 'review' | 'completed' | 'blocked';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    parentTaskId?: string;
    startDate?: string;
    endDate?: string;
    deadline?: string;
    estimatedHours?: number;
    assignees?: string[];
}

export interface UpdateTaskRequest {
    title?: string;
    description?: string;
    status?: 'todo' | 'in-progress' | 'completed';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    startDate?: string;
    endDate?: string;
    deadline?: string;
    estimatedHours?: number;
    assignees?: string[];
}

// ============================================
// TIME LOG API TYPES
// ============================================

export interface CreateTimeLogRequest {
    date: string;
    duration: number; // in minutes
    startTime?: string;
    endTime?: string;
    description?: string;
    hourlyRate?: number;
    billable?: boolean;
}

export interface UpdateTimeLogRequest {
    date?: string;
    duration?: number;
    startTime?: string;
    endTime?: string;
    description?: string;
    hourlyRate?: number;
    billable?: boolean;
}

// ============================================
// MEETING API TYPES
// ============================================

export interface CreateMeetingRequest {
    title: string;
    description?: string;
    type: 'internal' | 'external';
    participants: MeetingParticipant[];
    scheduledAt: string;
    duration: number;
    location?: string;
    agenda?: string;
    notes?: string;
    actionItems?: MeetingActionItem[];
    accessLevel?: 'project-team' | 'managers-only' | 'custom';
    customAccessUsers?: string[];
}

export interface UpdateMeetingRequest {
    title?: string;
    description?: string;
    type?: 'internal' | 'external';
    participants?: MeetingParticipant[];
    scheduledAt?: string;
    duration?: number;
    location?: string;
    agenda?: string;
    notes?: string;
    actionItems?: MeetingActionItem[];
    accessLevel?: 'project-team' | 'managers-only' | 'custom';
    customAccessUsers?: string[];
}

// ============================================
// CREDENTIAL API TYPES
// ============================================

export interface CreateCredentialRequest {
    name: string;
    type: 'env' | 'ssh-key' | 'test-user' | 'account' | '2fa' | 'other';
    description?: string;
    credentials: CredentialData;
    accessUsers: string[];
}

export interface UpdateCredentialRequest {
    name?: string;
    description?: string;
    credentials?: CredentialData;
    accessUsers?: string[];
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: {
        code?: string;
        details?: any;
    };
}

export type ProjectsResponse = ApiResponse<Project[]>;
export type ProjectResponse = ApiResponse<Project>;
export type TasksResponse = ApiResponse<Task[]>;
export type TaskResponse = ApiResponse<Task>;
export type TimeLogsResponse = ApiResponse<TimeLog[]>;
export type TimeLogResponse = ApiResponse<TimeLog>;
export type MeetingsResponse = ApiResponse<Meeting[]>;
export type MeetingResponse = ApiResponse<Meeting>;
export type CredentialsResponse = ApiResponse<Credential[]>;
export type CredentialResponse = ApiResponse<Credential>;
export type DocumentUrlResponse = ApiResponse<{ url: string }>;
