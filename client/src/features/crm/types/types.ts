// ============================================
// LEAD TYPES
// ============================================
export interface Lead {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    company: string;

    source: string;
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
// PROPOSAL SUB-INTERFACES
// ============================================

export interface ProposalOverview {
    project: string;
    purpose: string;
    outcome: string;
}

export interface ProposalPainPoint {
    title: string;
    description: string;
}

export interface ProposalBusinessChallenge {
    challenge: string;
    painPoints: ProposalPainPoint[];
}

export interface ProposalTargetAudience {
    primary: string;
    secondary?: string;
}

export interface ProposalGoals {
    business: string;
    operational: string;
    technical: string;
}

export interface ProposalScopePhase {
    title: string;
    summary: string;
    points: string[];
}

export interface ProposalScope {
    intro: string;
    phases: ProposalScopePhase[];
}

export interface ProposalFeatureItem {
    name: string;
    description: string;
}

export interface ProposalFeaturePhase {
    title: string;
    description: string;
    features: ProposalFeatureItem[];
}

export interface ProposalFeatures {
    intro: string;
    phases: ProposalFeaturePhase[];
}

export interface ProposalUserStep {
    title: string;
    description: string;
}

export interface ProposalUserFlow {
    intro: string;
    steps: ProposalUserStep[];
}

export interface ProposalTechStack {
    intro: string;
    frontend: string;
    uiStyling: string;
    stateManagement?: string;
    backend: string;
    database: string;
    fileStorage?: string;
    searchEngine?: string;
    aiIntegration?: string;
    automation?: string;
    notifications?: string;
    hosting: string;
    security: string;
    integrations: string[];
}

export interface ProposalNFR {
    intro: string;
    performance: string;
    accuracy?: string;
    reliability: string;
    security: string;
}

export interface ProposalDesign {
    intro: string;
    description: string;
}

export interface ProposalDeliverablePhase {
    name: string;
    items: string[];
}

export interface ProposalDeliverables {
    intro: string;
    phases: ProposalDeliverablePhase[];
}

export interface ProposalMetrics {
    intro: string;
    business: string[];
    user: string[];
    technical: string[];
}

export interface ProposalDependencies {
    intro: string;
    assumptions: string[];
    constraints: string[];
    clientRequirements: string[];
}

export interface ProposalActivity {
    title: string;
    duration: string;
    objective: string;
    activities: string[];
}

export interface ProposalTimeline {
    intro: string;
    phases: ProposalActivity[];
    releasePlan?: string;
}

export interface ProposalResource {
    role: string;
    count: number;
    duration: string;
}

export interface ProposalTeam {
    intro: string;
    resources: ProposalResource[];
}

export interface ProposalPaymentMilestone {
    milestone: string;
    percentage: number;
    amount: number;
}

export interface ProposalBudgetV2 {
    intro: string;
    includeExclude: string[];
    thirdPartyCosts: string[];
    paymentSchedule: ProposalPaymentMilestone[];
    currency: string;
    total: number;
}

export interface ProposalFutureItem {
    feature: string;
    description: string;
}

export interface ProposalFutureScope {
    intro: string;
    items: ProposalFutureItem[];
}

export interface ProposalRisk {
    risk: string;
    mitigation: string;
}

export interface ProposalRisks {
    intro: string;
    items: ProposalRisk[];
}

export interface ProposalTerms {
    intro: string;
    clauses: string[];
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
    scope?: string; // Legacy

    validUntil?: string;

    // New Structured Sections
    overview?: ProposalOverview;
    businessChallenge?: ProposalBusinessChallenge;
    targetAudience?: ProposalTargetAudience;
    goals?: ProposalGoals;
    scopeOfWork?: ProposalScope;
    features?: ProposalFeatures;
    userFlow?: ProposalUserFlow;
    techStack?: ProposalTechStack;
    nfr?: ProposalNFR;
    designRequirements?: ProposalDesign;
    deliverables?: ProposalDeliverables;
    successMetrics?: ProposalMetrics;
    dependencies?: ProposalDependencies;
    timeline?: ProposalTimeline;
    team?: ProposalTeam;
    budgetV2?: ProposalBudgetV2;
    futureScope?: ProposalFutureScope;
    risks?: ProposalRisks;
    terms?: ProposalTerms;
    conclusion?: string;
    nextSteps?: string[];

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
