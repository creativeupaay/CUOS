import mongoose, { Schema, Document, Types } from 'mongoose';

// ============================================
// SUB-INTERFACES & SCHEMAS
// ============================================

export interface IProposalOverview {
    project: string;
    purpose: string;
    outcome: string;
}

export interface IProposalPainPoint {
    title: string;
    description: string;
}

export interface IProposalBusinessChallenge {
    challenge: string;
    painPoints: IProposalPainPoint[];
}

export interface IProposalTargetAudience {
    primary: string;
    secondary?: string;
}

export interface IProposalGoals {
    business: string;
    operational: string;
    technical: string;
}

export interface IProposalScopePhase {
    title: string;
    summary: string;
    points: string[];
}

export interface IProposalScope {
    intro: string;
    phases: IProposalScopePhase[];
}

export interface IProposalFeatureItem {
    name: string;
    description: string;
}

export interface IProposalFeaturePhase {
    title: string;
    description: string;
    features: IProposalFeatureItem[];
}

export interface IProposalFeatures {
    intro: string;
    phases: IProposalFeaturePhase[];
}

export interface IProposalUserStep {
    title: string;
    description: string;
}

export interface IProposalUserFlow {
    intro: string;
    steps: IProposalUserStep[];
}

export interface IProposalTechStack {
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

export interface IProposalNFR {
    intro: string;
    performance: string;
    accuracy?: string;
    reliability: string;
    security: string;
}

export interface IProposalDesign {
    intro: string;
    description: string;
}

export interface IProposalDeliverablePhase {
    name: string;
    items: string[];
}

export interface IProposalDeliverables {
    intro: string;
    phases: IProposalDeliverablePhase[];
}

export interface IProposalMetrics {
    intro: string;
    business: string[];
    user: string[];
    technical: string[];
}

export interface IProposalDependencies {
    intro: string;
    assumptions: string[];
    constraints: string[];
    clientRequirements: string[];
}

export interface IProposalActivity {
    title: string;
    duration: string;
    objective: string;
    activities: string[];
}

export interface IProposalTimeline {
    intro: string;
    phases: IProposalActivity[];
    releasePlan?: string;
}

export interface IProposalResource {
    role: string;
    count: number;
    duration: string;
}

export interface IProposalTeam {
    intro: string;
    resources: IProposalResource[];
}

export interface IProposalPaymentMilestone {
    milestone: string;
    percentage: number;
    amount: number;
}

export interface IProposalBudgetV2 {
    intro: string;
    includeExclude: string[];
    thirdPartyCosts: string[];
    paymentSchedule: IProposalPaymentMilestone[];
    currency: string;
    total: number;
}

export interface IProposalFutureItem {
    feature: string;
    description: string;
}

export interface IProposalFutureScope {
    intro: string;
    items: IProposalFutureItem[];
}

export interface IProposalRisk {
    risk: string;
    mitigation: string;
}

export interface IProposalRisks {
    intro: string;
    items: IProposalRisk[];
}

export interface IProposalTerms {
    intro: string;
    clauses: string[];
}

// Existing IProposalLineItem for backward compatibility and calculation
export interface IProposalLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

const ProposalLineItemSchema = new Schema<IProposalLineItem>(
    {
        description: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
    },
    { _id: true }
);

// ============================================
// DOCUMENT SUB-SCHEMA
// ============================================
export interface IProposalDocument {
    name: string;
    cloudinaryId: string;
    uploadedAt: Date;
    uploadedBy: Types.ObjectId;
}

const ProposalDocumentSchema = new Schema<IProposalDocument>(
    {
        name: { type: String, required: true, trim: true },
        cloudinaryId: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { _id: true }
);

// ============================================
// AUDIT LOG SUB-SCHEMA
// ============================================
export interface IProposalAuditEntry {
    action: string;
    performedBy: Types.ObjectId;
    performedAt: Date;
    details?: string;
}

const ProposalAuditEntrySchema = new Schema<IProposalAuditEntry>(
    {
        action: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        performedAt: { type: Date, default: Date.now },
        details: { type: String },
    },
    { _id: true }
);

// ============================================
// PROPOSAL SCHEMA
// ============================================
export interface IProposal extends Document {
    _id: Types.ObjectId;
    title: string;
    leadId: Types.ObjectId;
    clientId?: Types.ObjectId;
    status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
    version: number;
    validUntil?: Date;

    // Structured Content Sections
    overview?: IProposalOverview;
    businessChallenge?: IProposalBusinessChallenge;
    targetAudience?: IProposalTargetAudience;
    goals?: IProposalGoals;
    scopeOfWork?: IProposalScope;
    features?: IProposalFeatures;
    userFlow?: IProposalUserFlow;
    techStack?: IProposalTechStack;
    nfr?: IProposalNFR;
    designRequirements?: IProposalDesign;
    deliverables?: IProposalDeliverables;
    successMetrics?: IProposalMetrics;
    dependencies?: IProposalDependencies;
    timeline?: IProposalTimeline;
    team?: IProposalTeam;
    budgetV2?: IProposalBudgetV2;
    futureScope?: IProposalFutureScope;
    risks?: IProposalRisks;
    terms?: IProposalTerms;
    conclusion?: string;
    nextSteps?: string[];

    // Legacy/Calculator fields (still used for quick math)
    items: IProposalLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;

    documents: IProposalDocument[];
    auditLog: IProposalAuditEntry[];
    notes?: string;

    sentAt?: Date;
    acceptedAt?: Date;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ProposalSchema = new Schema<IProposal>(
    {
        title: { type: String, required: true, trim: true },
        leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
        status: {
            type: String,
            enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
            default: 'draft',
        },
        version: { type: Number, default: 1 },
        validUntil: { type: Date },

        // New Structured Fields (Mixed types for flexibility or defined sub-schemas)
        // Using Mixed/SubSchemas slightly loosely to avoid massive Schema verbosity, 
        // but defining structure in Interfaces for TS safety.
        overview: {
            project: String,
            purpose: String,
            outcome: String
        },
        businessChallenge: {
            challenge: String,
            painPoints: [{ title: String, description: String }]
        },
        targetAudience: {
            primary: String,
            secondary: String
        },
        goals: {
            business: String,
            operational: String,
            technical: String
        },
        scopeOfWork: {
            intro: String,
            phases: [{ title: String, summary: String, points: [String] }]
        },
        features: {
            intro: String,
            phases: [{ title: String, description: String, features: [{ name: String, description: String }] }]
        },
        userFlow: {
            intro: String,
            steps: [{ title: String, description: String }]
        },
        techStack: {
            intro: String,
            frontend: String,
            uiStyling: String,
            stateManagement: String,
            backend: String,
            database: String,
            fileStorage: String,
            searchEngine: String,
            aiIntegration: String,
            automation: String,
            notifications: String,
            hosting: String,
            security: String,
            integrations: [String]
        },
        nfr: {
            intro: String,
            performance: String,
            accuracy: String,
            reliability: String,
            security: String
        },
        designRequirements: {
            intro: String,
            description: String
        },
        deliverables: {
            intro: String,
            phases: [{ name: String, items: [String] }]
        },
        successMetrics: {
            intro: String,
            business: [String],
            user: [String],
            technical: [String]
        },
        dependencies: {
            intro: String,
            assumptions: [String],
            constraints: [String],
            clientRequirements: [String]
        },
        timeline: {
            intro: String,
            phases: [{ title: String, duration: String, objective: String, activities: [String] }],
            releasePlan: String
        },
        team: {
            intro: String,
            resources: [{ role: String, count: Number, duration: String }]
        },
        budgetV2: {
            intro: String,
            includeExclude: [String],
            thirdPartyCosts: [String],
            paymentSchedule: [{ milestone: String, percentage: Number, amount: Number }],
            currency: { type: String, default: 'INR' },
            total: Number
        },
        futureScope: {
            intro: String,
            items: [{ feature: String, description: String }]
        },
        risks: {
            intro: String,
            items: [{ risk: String, mitigation: String }]
        },
        terms: {
            intro: String,
            clauses: [String]
        },
        conclusion: String,
        nextSteps: [String],

        // Legacy fields
        items: [ProposalLineItemSchema],
        subtotal: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        total: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'INR' },

        documents: [ProposalDocumentSchema],
        auditLog: [ProposalAuditEntrySchema],
        notes: { type: String, trim: true },

        sentAt: { type: Date },
        acceptedAt: { type: Date },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    {
        timestamps: true,
    }
);

// Auto-compute subtotal and total before save (from items)
ProposalSchema.pre('save', function (next) {
    if (this.items && this.items.length > 0) {
        this.items.forEach((item) => {
            item.total = item.quantity * item.unitPrice;
        });
        this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
        this.total = this.subtotal + (this.tax || 0);
    }
    // Also sync budgetV2 total if needed, or leave independent?
    // For now, let's keep 'items' as the source of truth for the simplified total logic in the list view,
    // and budgetV2 can be the detailed breakdown.
    next();
});

// Indexes
ProposalSchema.index({ leadId: 1 });
ProposalSchema.index({ clientId: 1 });
ProposalSchema.index({ status: 1 });
ProposalSchema.index({ createdAt: -1 });

export const Proposal = mongoose.model<IProposal>('Proposal', ProposalSchema);
