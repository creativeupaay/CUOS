import type { Lead, Proposal } from './types';

export interface LeadDocumentPayload {
    name: string;
    url: string;
    cloudinaryId: string;
    size?: number;
    mimeType?: string;
    uploadedAt?: string;
    uploadedBy?: string;
}

export interface LeadLinkPayload {
    name: string;
    url: string;
    addedAt?: string;
}

// ============================================
// GENERIC API RESPONSE
// ============================================
export interface ApiResponse<T = any> {
    status: string;
    data: T;
}

// ============================================
// LEAD API TYPES
// ============================================
export interface CreateLeadRequest {
    name: string;
    email?: string;
    phone?: string;
    company: string;
    source?: string;
    stage?: Lead['stage'];
    priority?: Lead['priority'];
    estimatedValue?: number;
    currency?: string;
    notes?: string;
    tags?: string[];
    documents?: LeadDocumentPayload[];
    links?: LeadLinkPayload[];
    assignedTo?: string;
    partnerId?: string;
    expectedCloseDate?: string;
}

export interface UpdateLeadRequest {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
    stage?: Lead['stage'];
    priority?: Lead['priority'];
    estimatedValue?: number;
    currency?: string;
    notes?: string;
    tags?: string[];
    documents?: LeadDocumentPayload[];
    links?: LeadLinkPayload[];
    assignedTo?: string | null;
    partnerId?: string | null;
    lostReason?: string;
    expectedCloseDate?: string | null;
}

export interface UploadLeadDocumentRequest {
    leadId: string;
    file: File;
}

export interface UploadLeadDocumentsRequest {
    leadId: string;
    files: File[];
}

export interface ListLeadsParams {
    stage?: Lead['stage'];
    source?: string;
    priority?: Lead['priority'];
    assignedTo?: string;
    partnerId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface ListLeadsResponse {
    leads: Lead[];
    total: number;
    page: number;
    totalPages: number;
}

export interface AddActivityRequest {
    type: 'call' | 'email' | 'meeting' | 'note';
    description: string;
    date?: string;
}

export interface AddMeetingRequest {
    type: 'internal' | 'external';
    title: string;
    notes?: string;
    date?: string;
}

// ============================================
// PROPOSAL API TYPES
// ============================================
export interface CreateProposalRequest {
    title: string;
    leadId: string;
    clientId?: string;
    validUntil?: string;
    scope?: string;
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
        total?: number;
    }[];
    tax?: number;
    currency?: string;
    notes?: string;
}

export interface UpdateProposalRequest {
    title?: string;
    validUntil?: string | null;
    scope?: string;
    items?: {
        description: string;
        quantity: number;
        unitPrice: number;
        total?: number;
    }[];
    tax?: number;
    currency?: string;
    notes?: string;
}

export interface ListProposalsParams {
    leadId?: string;
    status?: Proposal['status'];
    search?: string;
    page?: number;
    limit?: number;
}

export interface ListProposalsResponse {
    proposals: Proposal[];
    total: number;
    page: number;
    totalPages: number;
}

export interface UpdateProposalStatusRequest {
    status: 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
}
