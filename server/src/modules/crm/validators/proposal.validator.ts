import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// ============================================
// SUB-SCHEMAS
// ============================================

export const lineItemSchema = z.object({
    description: z.string().min(1, 'Description is required').trim(),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    unitPrice: z.number().min(0, 'Unit price must be >= 0'),
    total: z.number().min(0).optional(), // Auto-computed
});

const overviewSchema = z.object({
    project: z.string().optional(),
    purpose: z.string().optional(),
    outcome: z.string().optional(),
});

const painPointSchema = z.object({
    title: z.string().min(1, 'Title needed'),
    description: z.string().optional(),
});

const businessChallengeSchema = z.object({
    challenge: z.string().optional(),
    painPoints: z.array(painPointSchema).optional(),
});

const targetAudienceSchema = z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
});

const goalsSchema = z.object({
    business: z.string().optional(),
    operational: z.string().optional(),
    technical: z.string().optional(),
});

const scopePhaseSchema = z.object({
    title: z.string().min(1, 'Phase Title needed'),
    summary: z.string().optional(),
    points: z.array(z.string()).optional(),
});

const scopeOfWorkSchema = z.object({
    intro: z.string().optional(),
    phases: z.array(scopePhaseSchema).optional(),
});

const featureItemSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
});

const featurePhaseSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    features: z.array(featureItemSchema).optional(),
});

const featuresSchema = z.object({
    intro: z.string().optional(),
    phases: z.array(featurePhaseSchema).optional(),
});

const userStepSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
});

const userFlowSchema = z.object({
    intro: z.string().optional(),
    steps: z.array(userStepSchema).optional(),
});

const techStackSchema = z.object({
    intro: z.string().optional(),
    frontend: z.string().optional(),
    uiStyling: z.string().optional(),
    stateManagement: z.string().optional(),
    backend: z.string().optional(),
    database: z.string().optional(),
    fileStorage: z.string().optional(),
    searchEngine: z.string().optional(),
    aiIntegration: z.string().optional(),
    automation: z.string().optional(),
    notifications: z.string().optional(),
    hosting: z.string().optional(),
    security: z.string().optional(),
    integrations: z.array(z.string()).optional(),
});

const nfrSchema = z.object({
    intro: z.string().optional(),
    performance: z.string().optional(),
    accuracy: z.string().optional(),
    reliability: z.string().optional(),
    security: z.string().optional(),
});

const designRequirementsSchema = z.object({
    intro: z.string().optional(),
    description: z.string().optional(),
});

const deliverablePhaseSchema = z.object({
    name: z.string().min(1),
    items: z.array(z.string()).optional(),
});

const deliverablesSchema = z.object({
    intro: z.string().optional(),
    phases: z.array(deliverablePhaseSchema).optional(),
});

const successMetricsSchema = z.object({
    intro: z.string().optional(),
    business: z.array(z.string()).optional(),
    user: z.array(z.string()).optional(),
    technical: z.array(z.string()).optional(),
});

const dependenciesSchema = z.object({
    intro: z.string().optional(),
    assumptions: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
    clientRequirements: z.array(z.string()).optional(),
});

const timelineActivitySchema = z.object({
    title: z.string().min(1),
    duration: z.string().optional(),
    objective: z.string().optional(),
    activities: z.array(z.string()).optional(),
});

const timelineSchema = z.object({
    intro: z.string().optional(),
    phases: z.array(timelineActivitySchema).optional(),
    releasePlan: z.string().optional(),
});

const resourceSchema = z.object({
    role: z.string().min(1),
    count: z.number().optional(),
    duration: z.string().optional(),
});

const teamSchema = z.object({
    intro: z.string().optional(),
    resources: z.array(resourceSchema).optional(),
});

const paymentMilestoneSchema = z.object({
    milestone: z.string().min(1),
    percentage: z.number().optional(),
    amount: z.number().optional(),
});

const budgetV2Schema = z.object({
    intro: z.string().optional(),
    includeExclude: z.array(z.string()).optional(),
    thirdPartyCosts: z.array(z.string()).optional(),
    paymentSchedule: z.array(paymentMilestoneSchema).optional(),
    currency: z.string().optional(),
    total: z.number().optional(),
});

const futureItemSchema = z.object({
    feature: z.string().min(1),
    description: z.string().optional(),
});

const futureScopeSchema = z.object({
    intro: z.string().optional(),
    items: z.array(futureItemSchema).optional(),
});

const riskSchema = z.object({
    risk: z.string().min(1),
    mitigation: z.string().optional(),
});

const risksSchema = z.object({
    intro: z.string().optional(),
    items: z.array(riskSchema).optional(),
});

const termsSchema = z.object({
    intro: z.string().optional(),
    clauses: z.array(z.string()).optional(),
});

// ============================================
// PROPOSAL VALIDATORS
// ============================================

export const createProposalSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required').trim(),
        leadId: z.string().regex(objectIdRegex, 'Invalid lead ID'),
        clientId: z.string().regex(objectIdRegex, 'Invalid client ID').optional(),

        status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']).default('draft'),
        validUntil: z.string().optional(),

        // Sections
        overview: overviewSchema.optional(),
        businessChallenge: businessChallengeSchema.optional(),
        targetAudience: targetAudienceSchema.optional(),
        goals: goalsSchema.optional(),
        scopeOfWork: scopeOfWorkSchema.optional(),
        features: featuresSchema.optional(),
        userFlow: userFlowSchema.optional(),
        techStack: techStackSchema.optional(),
        nfr: nfrSchema.optional(),
        designRequirements: designRequirementsSchema.optional(),
        deliverables: deliverablesSchema.optional(),
        successMetrics: successMetricsSchema.optional(),
        dependencies: dependenciesSchema.optional(),
        timeline: timelineSchema.optional(),
        team: teamSchema.optional(),
        budgetV2: budgetV2Schema.optional(),
        futureScope: futureScopeSchema.optional(),
        risks: risksSchema.optional(),
        terms: termsSchema.optional(),
        conclusion: z.string().optional(),
        nextSteps: z.array(z.string()).optional(),

        // Legacy fields (optional now if using new structure, but good to keep for quick totals)
        items: z.array(lineItemSchema).optional(),
        subtotal: z.number().min(0).optional(),
        tax: z.number().min(0).default(0),
        currency: z.string().default('INR'),
        notes: z.string().optional(),
    }),
});

export const updateProposalSchema = z.object({
    body: z.object({
        title: z.string().min(1).trim().optional(),
        leadId: z.string().regex(objectIdRegex).optional(),
        clientId: z.string().regex(objectIdRegex).optional(),
        status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']).optional(),
        validUntil: z.string().optional().nullable(),

        // Sections
        overview: overviewSchema.optional(),
        businessChallenge: businessChallengeSchema.optional(),
        targetAudience: targetAudienceSchema.optional(),
        goals: goalsSchema.optional(),
        scopeOfWork: scopeOfWorkSchema.optional(),
        features: featuresSchema.optional(),
        userFlow: userFlowSchema.optional(),
        techStack: techStackSchema.optional(),
        nfr: nfrSchema.optional(),
        designRequirements: designRequirementsSchema.optional(),
        deliverables: deliverablesSchema.optional(),
        successMetrics: successMetricsSchema.optional(),
        dependencies: dependenciesSchema.optional(),
        timeline: timelineSchema.optional(),
        team: teamSchema.optional(),
        budgetV2: budgetV2Schema.optional(),
        futureScope: futureScopeSchema.optional(),
        risks: risksSchema.optional(),
        terms: termsSchema.optional(),
        conclusion: z.string().optional(),
        nextSteps: z.array(z.string()).optional(),

        // Legacy
        items: z.array(lineItemSchema).optional(),
        tax: z.number().min(0).optional(),
        currency: z.string().optional(),
        notes: z.string().optional(),
    }),
});

export const getProposalSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'Invalid proposal ID'),
    }),
});

export const listProposalsSchema = z.object({
    query: z.object({
        leadId: z.string().regex(objectIdRegex).optional(),
        status: z
            .enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'])
            .optional(),
        search: z.string().optional(),
        page: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .default(() => 1),
        limit: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .default(() => 20),
    }),
});

export const updateStatusSchema = z.object({
    body: z.object({
        status: z.enum(['sent', 'viewed', 'accepted', 'rejected', 'expired']),
    }),
});


// Export types
export type CreateProposalInput = z.infer<typeof createProposalSchema>['body'];
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>['body'];
export type GetProposalInput = z.infer<typeof getProposalSchema>['params'];
export type ListProposalsInput = z.infer<typeof listProposalsSchema>['query'];
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>['body'];
