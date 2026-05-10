import { randomUUID } from 'crypto';
import { ClientSession, Document, FilterQuery, Types } from 'mongoose';
import AppError from '../../../utils/appError';
import { logger } from '../../../utils/logger';
import { DeletedRecordService } from './deletedRecord.service';
import {
    ArchiveOperation,
    ArchiveWriteOptions,
    DeleteGraphNode,
    DeleteGraphRelationKind,
    DeleteGraphRelationshipSnapshot,
    DeleteGraphResult,
} from '../types/archive.types';
import {
    ArchiveRegistryModel,
    getArchiveModel,
    hasArchiveModel,
} from '../utils/modelRegistry.util';

interface DeleteGraphContext {
    rootModel: string;
    rootId: Types.ObjectId;
    rootDocument: Record<string, unknown> | null;
    idsByModel: Map<string, Types.ObjectId[]>;
}

interface DeleteGraphNodeDefinition {
    sourceModel: string;
    relationship: string;
    relationKind: DeleteGraphRelationKind;
    cascade: boolean;
    buildFilter: (context: DeleteGraphContext) => Record<string, unknown> | null;
    embeddedPaths?: string[];
    metadata?: Record<string, unknown>;
}

interface DeleteGraphDefinition {
    rootModel: string;
    nodes: DeleteGraphNodeDefinition[];
}

const asObjectId = (value: unknown): Types.ObjectId | null => {
    if (value instanceof Types.ObjectId) {
        return value;
    }

    if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
        return new Types.ObjectId(value);
    }

    return null;
};

const uniqueObjectIds = (ids: Array<Types.ObjectId | null | undefined>): Types.ObjectId[] => {
    const byValue = new Map<string, Types.ObjectId>();

    for (const id of ids) {
        if (id) {
            byValue.set(id.toString(), id);
        }
    }

    return Array.from(byValue.values());
};

const objectIdsFromValue = (value: unknown): Types.ObjectId[] => {
    if (Array.isArray(value)) {
        return uniqueObjectIds(value.flatMap(objectIdsFromValue));
    }

    const id = asObjectId(value);
    return id ? [id] : [];
};

const readRecord = (value: unknown): Record<string, unknown> | null => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
);

const getRootId = (context: DeleteGraphContext): Types.ObjectId => context.rootId;

const getRootFieldId = (context: DeleteGraphContext, fieldName: string): Types.ObjectId | null => (
    asObjectId(context.rootDocument?.[fieldName])
);

const getRootArrayIds = (context: DeleteGraphContext, fieldName: string): Types.ObjectId[] => (
    objectIdsFromValue(context.rootDocument?.[fieldName])
);

const getProjectPhaseIds = (context: DeleteGraphContext): Types.ObjectId[] => {
    const phases = Array.isArray(context.rootDocument?.phases) ? context.rootDocument.phases : [];

    return uniqueObjectIds(
        phases
            .map(readRecord)
            .flatMap((phase) => phase ? objectIdsFromValue(phase._id) : [])
    );
};

const getProjectPhaseLinkedIds = (context: DeleteGraphContext, fieldName: string): Types.ObjectId[] => {
    const phases = Array.isArray(context.rootDocument?.phases) ? context.rootDocument.phases : [];

    return uniqueObjectIds(
        phases
            .map(readRecord)
            .flatMap((phase) => phase ? objectIdsFromValue(phase[fieldName]) : [])
    );
};

const getIds = (context: DeleteGraphContext, sourceModel: string): Types.ObjectId[] => (
    context.idsByModel.get(sourceModel) ?? []
);

const idFilter = (id: Types.ObjectId): Record<string, unknown> => ({ _id: id });

const idInFilter = (ids: Types.ObjectId[]): Record<string, unknown> | null => (
    ids.length ? { _id: { $in: ids } } : null
);

const fieldFilter = (fieldName: string, id: Types.ObjectId | null): Record<string, unknown> | null => (
    id ? { [fieldName]: id } : null
);

const fieldInFilter = (fieldName: string, ids: Types.ObjectId[]): Record<string, unknown> | null => (
    ids.length ? { [fieldName]: { $in: ids } } : null
);

const orFilter = (...filters: Array<Record<string, unknown> | null>): Record<string, unknown> | null => {
    const activeFilters = filters.filter((filter): filter is Record<string, unknown> => Boolean(filter));

    if (activeFilters.length === 0) {
        return null;
    }

    if (activeFilters.length === 1) {
        return activeFilters[0];
    }

    return { $or: activeFilters };
};

const selfNode = (sourceModel: string): DeleteGraphNodeDefinition => ({
    sourceModel,
    relationship: 'self',
    relationKind: 'self',
    cascade: true,
    buildFilter: (context) => idFilter(getRootId(context)),
});

const byRootId = (
    sourceModel: string,
    fieldName: string,
    relationship: string,
    relationKind: DeleteGraphRelationKind = 'cascade',
    embeddedPaths?: string[]
): DeleteGraphNodeDefinition => ({
    sourceModel,
    relationship,
    relationKind,
    cascade: relationKind !== 'reference_only',
    embeddedPaths,
    buildFilter: (context) => fieldFilter(fieldName, getRootId(context)),
});

const byModelIds = (
    sourceModel: string,
    referencedModel: string,
    fieldName: string,
    relationship: string,
    relationKind: DeleteGraphRelationKind = 'cascade',
    embeddedPaths?: string[]
): DeleteGraphNodeDefinition => ({
    sourceModel,
    relationship,
    relationKind,
    cascade: relationKind !== 'reference_only',
    embeddedPaths,
    buildFilter: (context) => fieldInFilter(fieldName, getIds(context, referencedModel)),
});

const projectChildNodes = (projectIdsFromModel = 'Project'): DeleteGraphNodeDefinition[] => ([
    byModelIds('Task', projectIdsFromModel, 'projectId', 'project_tasks', 'cascade', ['activeTimers', 'accumulatedSeconds']),
    byModelIds('TimeLog', projectIdsFromModel, 'projectId', 'project_time_logs'),
    byModelIds('Meeting', projectIdsFromModel, 'projectId', 'project_meetings', 'cascade', ['participants', 'actionItems']),
    byModelIds('Credential', projectIdsFromModel, 'projectId', 'project_credentials', 'cascade', ['credentials']),
    byModelIds('DocFolder', projectIdsFromModel, 'projectId', 'project_document_folders'),
    byModelIds('DocItem', projectIdsFromModel, 'projectId', 'project_document_items', 'external_asset'),
    byModelIds('Note', projectIdsFromModel, 'projectId', 'project_notes', 'external_asset', ['blocks', 'mentions']),
    byModelIds('Comment', projectIdsFromModel, 'projectId', 'project_comments'),
    byModelIds('Expense', projectIdsFromModel, 'projectId', 'project_expenses', 'linked_finance'),
    byModelIds('FixedExpense', projectIdsFromModel, 'projectId', 'project_fixed_expenses', 'linked_finance'),
    byModelIds('FixedExpenseApproval', projectIdsFromModel, 'projectId', 'project_fixed_expense_approvals', 'linked_finance'),
]);

const projectFinanceNodes = (projectIdsFromModel = 'Project'): DeleteGraphNodeDefinition[] => ([
    {
        sourceModel: 'Revenue',
        relationship: 'project_revenue',
        relationKind: 'linked_finance',
        cascade: true,
        buildFilter: (context) => orFilter(
            fieldInFilter('projectId', getIds(context, projectIdsFromModel)),
            idInFilter(getProjectPhaseLinkedIds(context, 'revenueId'))
        ),
    },
    {
        sourceModel: 'BankTransaction',
        relationship: 'project_bank_transactions',
        relationKind: 'linked_finance',
        cascade: true,
        buildFilter: (context) => orFilter(
            fieldInFilter('projectId', getIds(context, projectIdsFromModel)),
            fieldInFilter('phaseId', getProjectPhaseIds(context)),
            fieldInFilter('revenueId', getIds(context, 'Revenue')),
            idInFilter(getProjectPhaseLinkedIds(context, 'bankTransactionId'))
        ),
    },
]);

const PROJECT_GRAPH: DeleteGraphDefinition = {
    rootModel: 'Project',
    nodes: [
        selfNode('Project'),
        ...projectChildNodes(),
        ...projectFinanceNodes(),
    ],
};

const CLIENT_GRAPH: DeleteGraphDefinition = {
    rootModel: 'Client',
    nodes: [
        selfNode('Client'),
        {
            sourceModel: 'Lead',
            relationship: 'client_lead_reference',
            relationKind: 'cascade',
            cascade: true,
            buildFilter: (context) => orFilter(
                idInFilter(getRootArrayIds(context, 'leadId')),
                fieldFilter('convertedClientId', getRootId(context))
            ),
        },
        {
            sourceModel: 'Proposal',
            relationship: 'client_proposals',
            relationKind: 'cascade',
            cascade: true,
            embeddedPaths: ['items', 'documents', 'auditLog', 'budgetV2', 'scopeOfWork', 'timeline'],
            buildFilter: (context) => orFilter(
                fieldFilter('clientId', getRootId(context)),
                fieldInFilter('leadId', getIds(context, 'Lead')),
                idInFilter(getRootArrayIds(context, 'proposalIds'))
            ),
        },
        byRootId('Project', 'clientId', 'client_projects'),
        ...projectChildNodes(),
        {
            sourceModel: 'Revenue',
            relationship: 'client_revenue',
            relationKind: 'linked_finance',
            cascade: true,
            buildFilter: (context) => orFilter(
                fieldFilter('clientId', getRootId(context)),
                fieldInFilter('projectId', getIds(context, 'Project'))
            ),
        },
        byModelIds('BankTransaction', 'Revenue', 'revenueId', 'client_revenue_bank_transactions', 'linked_finance'),
    ],
};

const EMPLOYEE_GRAPH: DeleteGraphDefinition = {
    rootModel: 'Employee',
    nodes: [
        selfNode('Employee'),
        {
            sourceModel: 'User',
            relationship: 'employee_user_account',
            relationKind: 'reference_only',
            cascade: false,
            buildFilter: (context) => idInFilter(uniqueObjectIds([getRootFieldId(context, 'userId')])),
        },
        byRootId('Attendance', 'employeeId', 'employee_attendance'),
        byRootId('Leave', 'employeeId', 'employee_leaves'),
        byRootId('LeaveBalance', 'employeeId', 'employee_leave_balances', 'cascade', ['balances']),
        byRootId('Payroll', 'employeeId', 'employee_payrolls', 'linked_finance', ['deductions']),
        byRootId('SalaryStructure', 'employeeId', 'employee_salary_structure', 'cascade', ['revisionHistory', 'deductions']),
        byRootId('EmployeeDocument', 'employeeId', 'employee_documents', 'external_asset'),
        byRootId('Incentive', 'employeeId', 'employee_incentives'),
        {
            sourceModel: 'Expense',
            relationship: 'employee_expenses',
            relationKind: 'linked_finance',
            cascade: true,
            buildFilter: (context) => orFilter(
                fieldFilter('employeeId', getRootId(context)),
                fieldInFilter('payrollId', getIds(context, 'Payroll'))
            ),
        },
        byModelIds('BankTransaction', 'Payroll', 'payrollId', 'payroll_bank_transactions', 'linked_finance'),
    ],
};

const HIRING_APPLICATION_GRAPH: DeleteGraphDefinition = {
    rootModel: 'Application',
    nodes: [
        selfNode('Application'),
        byRootId('ApplicationActivity', 'applicationId', 'application_activities'),
        byRootId('AssignmentSubmission', 'applicationId', 'application_assignment_submissions', 'external_asset', ['attachments', 'customFieldResponses']),
        byRootId('Interview', 'applicationId', 'application_interviews'),
        byRootId('InterviewNote', 'applicationId', 'application_interview_notes'),
        byRootId('InterviewNotification', 'applicationId', 'application_interview_notifications'),
        byRootId('Offer', 'applicationId', 'application_offers', 'external_asset'),
    ],
};

const HIRING_JOB_GRAPH: DeleteGraphDefinition = {
    rootModel: 'Job',
    nodes: [
        selfNode('Job'),
        byRootId('Application', 'jobId', 'job_applications', 'external_asset', ['customFieldResponses']),
        byRootId('Assignment', 'jobId', 'job_assignments', 'cascade', ['submissionFields']),
        byModelIds('ApplicationActivity', 'Application', 'applicationId', 'job_application_activities'),
        {
            sourceModel: 'AssignmentSubmission',
            relationship: 'job_assignment_submissions',
            relationKind: 'external_asset',
            cascade: true,
            embeddedPaths: ['attachments', 'customFieldResponses'],
            buildFilter: (context) => orFilter(
                fieldInFilter('applicationId', getIds(context, 'Application')),
                fieldInFilter('assignmentId', getIds(context, 'Assignment'))
            ),
        },
        byModelIds('Interview', 'Application', 'applicationId', 'job_interviews'),
        byModelIds('InterviewNote', 'Application', 'applicationId', 'job_interview_notes'),
        byModelIds('InterviewNotification', 'Application', 'applicationId', 'job_interview_notifications'),
        byModelIds('Offer', 'Application', 'applicationId', 'job_offers', 'external_asset'),
    ],
};

const PARTNER_GRAPH: DeleteGraphDefinition = {
    rootModel: 'Partner',
    nodes: [
        selfNode('Partner'),
        {
            sourceModel: 'User',
            relationship: 'partner_user_account',
            relationKind: 'cascade',
            cascade: true,
            buildFilter: (context) => idInFilter(uniqueObjectIds([getRootFieldId(context, 'userId')])),
        },
        byRootId('PartnerEmployee', 'partnerId', 'partner_employees'),
        byRootId('Client', 'partnerId', 'partner_clients', 'external_asset', ['documents', 'activities', 'links']),
        byRootId('Lead', 'partnerId', 'partner_leads', 'external_asset', ['documents', 'activities', 'meetings', 'links']),
        {
            sourceModel: 'Proposal',
            relationship: 'partner_proposals',
            relationKind: 'cascade',
            cascade: true,
            embeddedPaths: ['items', 'documents', 'auditLog', 'budgetV2', 'scopeOfWork', 'timeline'],
            buildFilter: (context) => orFilter(
                fieldInFilter('clientId', getIds(context, 'Client')),
                fieldInFilter('leadId', getIds(context, 'Lead'))
            ),
        },
        {
            sourceModel: 'Project',
            relationship: 'partner_projects',
            relationKind: 'cascade',
            cascade: true,
            buildFilter: (context) => orFilter(
                fieldFilter('partnerId', getRootId(context)),
                fieldInFilter('clientId', getIds(context, 'Client')),
                fieldInFilter('assignees.partnerId', [getRootId(context)])
            ),
        },
        ...projectChildNodes(),
        {
            sourceModel: 'Revenue',
            relationship: 'partner_revenue',
            relationKind: 'linked_finance',
            cascade: true,
            buildFilter: (context) => orFilter(
                fieldInFilter('clientId', getIds(context, 'Client')),
                fieldInFilter('projectId', getIds(context, 'Project'))
            ),
        },
        byModelIds('BankTransaction', 'Revenue', 'revenueId', 'partner_bank_transactions', 'linked_finance'),
    ],
};

const USER_GRAPH: DeleteGraphDefinition = {
    rootModel: 'User',
    nodes: [
        selfNode('User'),
        byRootId('Employee', 'userId', 'user_employee_profile', 'reference_only'),
        byRootId('Partner', 'userId', 'user_partner_profile', 'reference_only'),
        byRootId('Notification', 'userId', 'user_notifications'),
        byRootId('AuditLog', 'userId', 'user_audit_logs', 'reference_only'),
        byRootId('Project', 'createdBy', 'projects_created_by_user', 'reference_only'),
        byRootId('Task', 'createdBy', 'tasks_created_by_user', 'reference_only'),
        byRootId('Revenue', 'createdBy', 'revenue_created_by_user', 'reference_only'),
        byRootId('Expense', 'createdBy', 'expenses_created_by_user', 'reference_only'),
    ],
};

const ROLE_GRAPH: DeleteGraphDefinition = {
    rootModel: 'Role',
    nodes: [
        selfNode('Role'),
        byRootId('User', 'role', 'users_with_role', 'reference_only'),
    ],
};

const PERMISSION_GRAPH: DeleteGraphDefinition = {
    rootModel: 'Permission',
    nodes: [
        selfNode('Permission'),
        byRootId('Role', 'permissions', 'roles_with_permission', 'reference_only'),
    ],
};

const FINANCE_GRAPHS: DeleteGraphDefinition[] = [
    {
        rootModel: 'Revenue',
        nodes: [
            selfNode('Revenue'),
            byRootId('BankTransaction', 'revenueId', 'revenue_bank_transactions', 'linked_finance'),
        ],
    },
    {
        rootModel: 'Expense',
        nodes: [
            selfNode('Expense'),
            {
                sourceModel: 'BankTransaction',
                relationship: 'expense_bank_transaction',
                relationKind: 'linked_finance',
                cascade: true,
                buildFilter: (context) => orFilter(
                    fieldFilter('expenseId', getRootId(context)),
                    idInFilter(uniqueObjectIds([getRootFieldId(context, 'bankTransactionId')]))
                ),
            },
        ],
    },
    {
        rootModel: 'Payroll',
        nodes: [
            selfNode('Payroll'),
            byRootId('Expense', 'payrollId', 'payroll_expenses', 'linked_finance'),
            byRootId('BankTransaction', 'payrollId', 'payroll_bank_transactions', 'linked_finance'),
        ],
    },
    {
        rootModel: 'FixedExpense',
        nodes: [
            selfNode('FixedExpense'),
            byRootId('FixedExpenseApproval', 'fixedExpenseId', 'fixed_expense_approvals', 'linked_finance'),
        ],
    },
    {
        rootModel: 'FixedExpenseApproval',
        nodes: [
            selfNode('FixedExpenseApproval'),
            {
                sourceModel: 'Expense',
                relationship: 'fixed_expense_approval_expense',
                relationKind: 'linked_finance',
                cascade: true,
                buildFilter: (context) => idInFilter(uniqueObjectIds([getRootFieldId(context, 'approvedExpenseId')])),
            },
        ],
    },
    {
        rootModel: 'BankAccount',
        nodes: [
            selfNode('BankAccount'),
            byRootId('BankTransaction', 'bankAccountId', 'bank_account_transactions', 'reference_only'),
        ],
    },
    {
        rootModel: 'BankTransaction',
        nodes: [
            selfNode('BankTransaction'),
        ],
    },
];

const SIMPLE_SELF_GRAPHS: DeleteGraphDefinition[] = [
    { rootModel: 'Lead', nodes: [selfNode('Lead'), byRootId('Proposal', 'leadId', 'lead_proposals', 'cascade', ['items', 'documents', 'auditLog', 'budgetV2', 'scopeOfWork', 'timeline'])] },
    { rootModel: 'Proposal', nodes: [selfNode('Proposal')] },
    { rootModel: 'Assignment', nodes: [selfNode('Assignment'), byRootId('AssignmentSubmission', 'assignmentId', 'assignment_submissions', 'external_asset', ['attachments', 'customFieldResponses'])] },
    { rootModel: 'JobTemplate', nodes: [selfNode('JobTemplate')] },
    { rootModel: 'Holiday', nodes: [selfNode('Holiday')] },
    { rootModel: 'Announcement', nodes: [selfNode('Announcement')] },
];

const graphDefinitions = new Map<string, DeleteGraphDefinition>(
    [
        PROJECT_GRAPH,
        CLIENT_GRAPH,
        EMPLOYEE_GRAPH,
        PARTNER_GRAPH,
        HIRING_JOB_GRAPH,
        HIRING_APPLICATION_GRAPH,
        USER_GRAPH,
        ROLE_GRAPH,
        PERMISSION_GRAPH,
        ...FINANCE_GRAPHS,
        ...SIMPLE_SELF_GRAPHS,
    ].map((definition) => [definition.rootModel, definition])
);

const serializableFilter = (filter: Record<string, unknown>): Record<string, unknown> => (
    JSON.parse(JSON.stringify(filter)) as Record<string, unknown>
);

const getArchiveOperationForNode = (
    rootModel: string,
    node: DeleteGraphNode,
    requestedOperation?: ArchiveOperation
): ArchiveOperation => {
    if (requestedOperation) {
        return requestedOperation;
    }

    if (node.relationKind === 'self') {
        return rootModel === 'Project' ? 'soft_archive' : 'delete';
    }

    if (node.relationKind === 'linked_finance') {
        return 'delete';
    }

    if (node.relationKind === 'external_asset') {
        return 'external_retention';
    }

    return 'cascade_delete';
};

export class DeleteGraphService {
    static getSupportedRootModels(): string[] {
        return Array.from(graphDefinitions.keys()).sort();
    }

    static getDefinition(rootModel: string): DeleteGraphDefinition {
        const definition = graphDefinitions.get(rootModel);

        if (!definition) {
            throw new AppError(`No delete graph registered for ${rootModel}.`, 500, 'DELETE_GRAPH_NOT_REGISTERED');
        }

        return definition;
    }

    static toRelationshipSnapshot(graph: DeleteGraphResult): DeleteGraphRelationshipSnapshot {
        return {
            rootModel: graph.rootModel,
            rootCollection: graph.rootCollection,
            rootId: graph.rootId,
            archiveBatchId: graph.archiveBatchId,
            nodes: graph.nodes.map((node) => ({
                sourceModel: node.sourceModel,
                sourceCollection: node.sourceCollection,
                relationship: node.relationship,
                relationKind: node.relationKind,
                cascade: node.cascade,
                sourceIds: node.sourceIds,
                count: node.count,
                embeddedPaths: node.embeddedPaths,
                metadata: node.metadata,
            })),
        };
    }

    static async discoverGraph(
        rootModel: string,
        rootId: Types.ObjectId | string,
        options: { archiveBatchId?: string; session?: ClientSession } = {}
    ): Promise<DeleteGraphResult> {
        if (!hasArchiveModel(rootModel)) {
            throw new AppError(`No archive model registered for ${rootModel}.`, 500, 'ARCHIVE_MODEL_NOT_REGISTERED');
        }

        const archiveBatchId = options.archiveBatchId ?? randomUUID();
        const rootObjectId = rootId instanceof Types.ObjectId ? rootId : new Types.ObjectId(rootId);
        const definition = this.getDefinition(rootModel);
        const rootArchiveModel = getArchiveModel(rootModel);
        const rootDocument = await rootArchiveModel.findById(rootObjectId)
            .session(options.session ?? null)
            .lean()
            .exec() as Record<string, unknown> | null;
        const context: DeleteGraphContext = {
            rootModel,
            rootId: rootObjectId,
            rootDocument,
            idsByModel: new Map(),
        };
        const nodes: DeleteGraphNode[] = [];

        for (const nodeDefinition of definition.nodes) {
            const filter = nodeDefinition.buildFilter(context);

            if (!filter) {
                continue;
            }

            const model = getArchiveModel(nodeDefinition.sourceModel);
            const sourceIds = await this.findSourceIds(model, filter, options.session);
            const existingIds = getIds(context, nodeDefinition.sourceModel);
            context.idsByModel.set(
                nodeDefinition.sourceModel,
                uniqueObjectIds([...existingIds, ...sourceIds])
            );

            nodes.push({
                sourceModel: nodeDefinition.sourceModel,
                sourceCollection: model.collection.name,
                relationship: nodeDefinition.relationship,
                relationKind: nodeDefinition.relationKind,
                cascade: nodeDefinition.cascade,
                filter: serializableFilter(filter),
                sourceIds,
                count: sourceIds.length,
                embeddedPaths: nodeDefinition.embeddedPaths,
                metadata: nodeDefinition.metadata,
            });
        }

        return {
            rootModel,
            rootCollection: rootArchiveModel.collection.name,
            rootId: rootObjectId,
            archiveBatchId,
            nodes,
        };
    }

    static async archiveGraph(
        rootModel: string,
        rootId: Types.ObjectId | string,
        options: ArchiveWriteOptions = {}
    ): Promise<DeleteGraphResult> {
        const archiveBatchId = options.archiveBatchId ?? randomUUID();
        const graph = await this.discoverGraph(rootModel, rootId, {
            archiveBatchId,
            session: options.session,
        });
        const relationshipSnapshot = this.toRelationshipSnapshot(graph);

        for (const node of graph.nodes) {
            if (!node.cascade || node.sourceIds.length === 0) {
                continue;
            }

            const model = getArchiveModel(node.sourceModel);
            const documents = await model.find({ _id: { $in: node.sourceIds } } as FilterQuery<Record<string, unknown>>)
                .session(options.session ?? null)
                .exec();

            await DeletedRecordService.archiveDocuments(
                documents as unknown as Document[],
                {
                    ...options,
                    archiveBatchId,
                    operation: getArchiveOperationForNode(rootModel, node, options.operation),
                    sourceModel: node.sourceModel,
                    sourceCollection: node.sourceCollection,
                    relationshipSnapshot: {
                        parent: {
                            sourceModel: graph.rootModel,
                            sourceCollection: graph.rootCollection,
                            sourceId: graph.rootId,
                        },
                        children: relationshipSnapshot.nodes
                            .filter((relationshipNode) => relationshipNode.sourceIds.length > 0)
                            .map((relationshipNode) => ({
                                sourceModel: relationshipNode.sourceModel,
                                sourceCollection: relationshipNode.sourceCollection,
                                sourceIds: relationshipNode.sourceIds,
                                relationship: relationshipNode.relationship,
                            })),
                        deleteGraph: relationshipSnapshot,
                    },
                    metadata: {
                        ...options.metadata,
                        deleteGraphRelationship: node.relationship,
                        deleteGraphRelationKind: node.relationKind,
                    },
                }
            );

            if (documents.length !== node.sourceIds.length) {
                logger.error(
                    {
                        archiveBatchId,
                        rootModel,
                        rootId: graph.rootId.toString(),
                        sourceModel: node.sourceModel,
                        sourceCollection: node.sourceCollection,
                        relationship: node.relationship,
                        expectedCount: node.sourceIds.length,
                        archivedCount: documents.length,
                        sourceIds: node.sourceIds.map((sourceId) => sourceId.toString()),
                    },
                    'Delete graph archive count verification failed'
                );
                throw new AppError('Delete graph archive count verification failed.', 500, 'DELETE_GRAPH_ARCHIVE_COUNT_MISMATCH');
            }

            logger.info(
                {
                    archiveBatchId,
                    actorId: options.deletedBy?.toString(),
                    operation: getArchiveOperationForNode(rootModel, node, options.operation),
                    rootModel,
                    rootId: graph.rootId.toString(),
                    sourceModel: node.sourceModel,
                    sourceCollection: node.sourceCollection,
                    relationship: node.relationship,
                    archivedCount: documents.length,
                    sourceIds: node.sourceIds.map((sourceId) => sourceId.toString()),
                },
                'Delete graph node archived'
            );
        }

        logger.info(
            {
                archiveBatchId,
                actorId: options.deletedBy?.toString(),
                rootModel,
                rootId: graph.rootId.toString(),
                collectionCounts: graph.nodes.reduce<Record<string, number>>((counts, node) => {
                    counts[node.sourceCollection] = (counts[node.sourceCollection] ?? 0) + node.count;
                    return counts;
                }, {}),
            },
            'Delete graph archive completed'
        );

        return graph;
    }

    private static async findSourceIds(
        model: ArchiveRegistryModel,
        filter: Record<string, unknown>,
        session?: ClientSession
    ): Promise<Types.ObjectId[]> {
        const records = await model.find(filter as FilterQuery<Record<string, unknown>>)
            .select('_id')
            .session(session ?? null)
            .lean()
            .exec() as Array<{ _id?: Types.ObjectId | string }>;

        return uniqueObjectIds(records.map((record) => asObjectId(record._id)));
    }
}
