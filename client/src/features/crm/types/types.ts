// ============================================
// LEAD TYPES
// ============================================
export interface Lead {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;

    source: 'website' | 'referral' | 'cold-call' | 'social-media' | 'event' | 'other';
    stage: 'new' | 'contacted' | 'qualified' | 'proposal-sent' | 'negotiation' | 'closed' | 'pending' | 'lead-lost' | 'follow-up';
    priority: 'low' | 'medium' | 'high' | 'critical';

    estimatedValue?: number;
    currency: string;

    notes?: string;
    tags: string[];

    assignedTo?: string | User;
    convertedClientId?: string | Client;

    isLocked: boolean;
    closedAt?: string;
    lostReason?: string;
    expectedCloseDate?: string;

    activities: LeadActivity[];
    meetings: LeadMeeting[];

    createdBy: string | User;
    createdAt: string;
    updatedAt: string;
}

export interface LeadActivity {
    _id: string;
    type: 'call' | 'email' | 'meeting' | 'note';
    description: string;
    date: string;
    createdBy: string | User;
}

export interface LeadMeeting {
    _id: string;
    type: 'internal' | 'external';
    title: string;
    notes: string;
    date: string;
    createdBy: string | User;
}

// ============================================
// PROPOSAL TYPES
// ============================================
export interface Proposal {
    _id: string;
    title: string;
    leadId: string | Lead;
    clientId?: string | Client;

    status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

    version: number;
    parentProposalId?: string;
    scope?: string;

    validUntil?: string;

    items: ProposalLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;

    documents: ProposalDocument[];
    auditLog: ProposalAuditEntry[];

    notes?: string;

    sentAt?: string;
    acceptedAt?: string;

    createdBy: string | User;
    createdAt: string;
    updatedAt: string;
}

export interface ProposalLineItem {
    _id?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface ProposalDocument {
    _id?: string;
    name: string;
    cloudinaryId: string;
    uploadedAt: string;
    uploadedBy: string | User;
}

export interface ProposalAuditEntry {
    _id?: string;
    action: string;
    performedBy: string | User;
    performedAt: string;
    details?: string;
}

// ============================================
// PIPELINE TYPES
// ============================================
export interface PipelineStageSummary {
    stage: string;
    count: number;
    totalValue: number;
}

export interface PipelineSummary {
    stages: PipelineStageSummary[];
    totalLeads: number;
    totalValue: number;
}

// ============================================
// SHARED TYPES
// ============================================
export interface User {
    _id: string;
    name: string;
    email: string;
    role: string;
}

export interface Client {
    _id: string;
    name: string;
    email: string;
    phone?: string;
}
