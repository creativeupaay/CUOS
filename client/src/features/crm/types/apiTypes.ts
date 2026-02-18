import type { Lead, Proposal } from './types';

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
    email: string;
    phone?: string;
    company?: string;
    source?: Lead['source'];
    stage?: Lead['stage'];
    priority?: Lead['priority'];
    estimatedValue?: number;
    currency?: string;
    notes?: string;
    tags?: string[];
    assignedTo?: string;
    expectedCloseDate?: string;
}

export interface UpdateLeadRequest {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: Lead['source'];
    stage?: Lead['stage'];
    priority?: Lead['priority'];
    estimatedValue?: number;
    currency?: string;
    notes?: string;
    tags?: string[];
    assignedTo?: string | null;
    lostReason?: string;
    expectedCloseDate?: string | null;
}

export interface ListLeadsParams {
    stage?: Lead['stage'];
    source?: Lead['source'];
    priority?: Lead['priority'];
    assignedTo?: string;
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

// ============================================
// PROPOSAL API TYPES
// ============================================
export interface CreateProposalRequest {
    title: string;
    leadId: string;
    clientId?: string;
    validUntil?: string;
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
