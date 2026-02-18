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
    stage: 'new' | 'contacted' | 'qualified' | 'proposal-sent' | 'negotiation' | 'won' | 'lost';
    priority: 'low' | 'medium' | 'high' | 'critical';

    estimatedValue?: number;
    currency: string;

    notes?: string;
    tags: string[];

    assignedTo?: string | User;
    convertedClientId?: string | Client;

    lostReason?: string;
    expectedCloseDate?: string;

    activities: LeadActivity[];

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

// ============================================
// PROPOSAL TYPES
// ============================================
export interface Proposal {
    _id: string;
    title: string;
    leadId: string | Lead;
    clientId?: string | Client;

    status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

    validUntil?: string;

    items: ProposalLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;

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
