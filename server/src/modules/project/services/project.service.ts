import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project.model';
import { Task } from '../models/Task.model';
import { DocFolder } from '../models/DocFolder.model';
import { Revenue } from '../../finance/models/Revenue.model';
import { BankTransaction } from '../../finance/models/BankTransaction.model';
import { BankTransactionService } from '../../finance/services/bankTransaction.service';
import { ExchangeRateService } from '../../finance/services/exchangeRate.service';
import { DeletedRecordService, DeleteGraphResult, DeleteGraphService } from '../../archive';
import { User } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import { Employee } from '../../hrms/models/Employee.model';
import { Partner } from '../../partners/models/Partner.model';
import AppError from '../../../utils/appError';
import {
    uploadDocument,
    getSignedUrl,
} from '../../../utils/cloudinary.util';

export interface CreateProjectData {
    name: string;
    description?: string;
    status?: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    clientId: string;
    startDate: Date;
    endDate?: Date;
    deadline?: Date;
    budget?: number;
    currency?: string;
    billingType?: 'fixed' | 'hourly' | 'milestone';
    hourlyRate?: number;
    defaultBankAccount?: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
    invoiceDetails?: any;
    phases?: any[];
    assignees?: Array<{
        employeeId?: string;
        partnerEmployeeId?: string;
        partnerId?: string;
        userId?: string;
        memberType: 'employee' | 'partner-employee' | 'partner';
        role: 'admin' | 'manager' | 'developer' | 'designer' | 'qa' | 'viewer' | 'member';
        subModules?: {
            overview: boolean;
            tasks: boolean;
            timeLogs: boolean;
            meetings: boolean;
            credentials: boolean;
            documents: boolean;
            notes: boolean;
        };
    }>;
    partnerId?: string;
    createdBy: string;
}

export interface UpdateProjectData {
    name?: string;
    description?: string;
    status?: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    startDate?: Date;
    endDate?: Date;
    deadline?: Date;
    budget?: number;
    currency?: string;
    billingType?: 'fixed' | 'hourly' | 'milestone';
    hourlyRate?: number;
    invoiceDetails?: any;
    defaultBankAccount?: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
    phases?: any[];
}

export interface DeleteProjectOptions {
    deletedBy?: string;
    reason?: string;
    archiveBatchId?: string;
}

const roundMoney = (value: number) => Math.round(Number(value || 0) * 100) / 100;

const getIdString = (value: any): string | undefined => {
    if (!value) return undefined;
    if (value._id) return String(value._id);
    return String(value);
};

const getPhaseExpectedAmount = (phase: any, project: any): { amount: number; currency: string } => {
    const currency = phase?.paymentCurrency || project?.currency || 'INR';
    if (Number(phase?.paymentAmount || 0) > 0) {
        return { amount: Number(phase.paymentAmount || 0), currency };
    }
    if (Number(phase?.paymentPercentage || 0) > 0 && Number(project?.budget || 0) > 0) {
        return {
            amount: (Number(project.budget || 0) * Number(phase.paymentPercentage || 0)) / 100,
            currency,
        };
    }
    return { amount: 0, currency };
};

interface ManualFxRateRequirement {
    phaseIndex: number;
    phaseId?: string;
    phaseName: string;
    currency: string;
    date: string;
    amount: number;
}

const toDate = (value: any): Date | undefined => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
};

const toDateKey = (value: any): string | undefined => {
    const date = toDate(value);
    return date ? date.toISOString().slice(0, 10) : undefined;
};

const getPhaseConversionDate = (phase: any, project: any): Date => (
    toDate(phase.paymentDueDate)
    || toDate(phase.endDate)
    || toDate(project.endDate)
    || new Date()
);

const shouldUseIncomingManualRate = (
    phase: any,
    _existingPhase: any,
    currency: string,
    conversionDate: Date
): boolean => {
    const rate = Number(phase.paymentExchangeRate || 0);
    if (!Number.isFinite(rate) || rate <= 0 || phase.paymentFxRateSource !== 'manual') {
        return false;
    }

    const requestedDateKey = conversionDate.toISOString().slice(0, 10);
    const incomingDateKey = toDateKey(phase.paymentFxRequestedDate || phase.paymentExchangeRateDate);
    return !incomingDateKey || incomingDateKey === requestedDateKey || currency === 'INR';
};

const normalizePhasePaymentFinancials = async (
    projectDraft: any,
    phases: any[],
    existingProject?: any
): Promise<any[]> => {
    const existingById = new Map<string, any>();
    for (const phase of existingProject?.phases || []) {
        const phaseId = getIdString(phase._id);
        if (phaseId) existingById.set(phaseId, phase);
    }

    const manualRateRequirements: ManualFxRateRequirement[] = [];
    const normalizedPhases = await Promise.all(phases.map(async (phase, phaseIndex) => {
        const cleaned = { ...phase };
        const phaseId = getIdString(cleaned._id);
        const existingPhase = phaseId ? existingById.get(phaseId) : undefined;

        if (!cleaned.hasPayment) {
            delete cleaned.paymentAmount;
            delete cleaned.paymentPercentage;
            delete cleaned.paymentCurrency;
            delete cleaned.paymentDueDate;
            delete cleaned.paymentBankAccount;
            delete cleaned.paymentReceivedAmount;
            delete cleaned.paymentExpectedAmountINR;
            delete cleaned.paymentReceivedAmountINR;
            delete cleaned.paymentExchangeRate;
            delete cleaned.paymentExchangeRateDate;
            delete cleaned.paymentSettlementCurrency;
            delete cleaned.paymentFxRateSource;
            delete cleaned.paymentFxRequestedDate;
            delete cleaned.paymentFxFallbackUsed;
            delete cleaned.gstApplicable;
            delete cleaned.gstRate;
            delete cleaned.tdsDeducted;
            return cleaned;
        }

        const { amount, currency } = getPhaseExpectedAmount(cleaned, projectDraft);
        cleaned.paymentCurrency = currency as any;

        if (amount <= 0) {
            delete cleaned.paymentExpectedAmountINR;
            delete cleaned.paymentExchangeRate;
            delete cleaned.paymentExchangeRateDate;
            delete cleaned.paymentFxRateSource;
            delete cleaned.paymentFxRequestedDate;
            delete cleaned.paymentFxFallbackUsed;
            return cleaned;
        }

        const conversionDate = getPhaseConversionDate(cleaned, projectDraft);
        const manualRate = shouldUseIncomingManualRate(cleaned, existingPhase, currency, conversionDate)
            ? Number(cleaned.paymentExchangeRate)
            : undefined;

        try {
            const conversion = await ExchangeRateService.convertToINR(amount, currency, conversionDate, {
                manualRate,
                allowLatestFallback: true,
            });

            cleaned.paymentExpectedAmountINR = conversion.amountINR;
            cleaned.paymentExchangeRate = conversion.rate;
            cleaned.paymentExchangeRateDate = conversion.date;
            cleaned.paymentSettlementCurrency = 'INR';
            cleaned.paymentFxRateSource = conversion.source;
            cleaned.paymentFxRequestedDate = conversion.requestedDate;
            cleaned.paymentFxFallbackUsed = conversion.fallbackUsed;
            cleaned.paymentReceivedAmount = roundMoney(Number(
                cleaned.paymentReceivedAmountINR
                ?? cleaned.paymentReceivedAmount
                ?? existingPhase?.paymentReceivedAmountINR
                ?? existingPhase?.paymentReceivedAmount
                ?? 0
            ));
            cleaned.paymentReceivedAmountINR = cleaned.paymentReceivedAmount;
            cleaned.paymentStatus = cleaned.paymentStatus || 'pending';
            return cleaned;
        } catch (error: any) {
            manualRateRequirements.push({
                phaseIndex,
                phaseId,
                phaseName: String(cleaned.name || `Phase ${phaseIndex + 1}`),
                currency,
                date: conversionDate.toISOString().slice(0, 10),
                amount: roundMoney(amount),
            });
            return cleaned;
        }
    }));

    if (manualRateRequirements.length > 0) {
        throw new AppError(
            'Manual exchange rate required for one or more phase payments',
            409,
            'FX_RATE_REQUIRED',
            { requirements: manualRateRequirements }
        );
    }

    return normalizedPhases;
};

const getRevenueStatus = (
    totalAmount: number,
    receivedAmount: number,
    dueDate?: Date
): 'received' | 'pending' | 'partial' | 'overdue' => {
    if (receivedAmount >= totalAmount) return 'received';
    if (receivedAmount > 0) return 'partial';
    if (dueDate && new Date() > dueDate) return 'overdue';
    return 'pending';
};

const deleteBankTransactionAndAdjustBalance = async (id: Types.ObjectId | string): Promise<void> => {
    const existing = await BankTransaction.findById(id);
    if (!existing) return;

    await BankTransactionService.delete(existing._id);
};

const getDeleteGraphNodeIds = (
    graph: DeleteGraphResult,
    sourceModel: string,
    relationship?: string
): Types.ObjectId[] => {
    const ids = new Map<string, Types.ObjectId>();

    for (const node of graph.nodes) {
        if (node.sourceModel !== sourceModel) continue;
        if (relationship && node.relationship !== relationship) continue;

        for (const sourceId of node.sourceIds) {
            ids.set(sourceId.toString(), sourceId);
        }
    }

    return Array.from(ids.values());
};

const buildProjectArchiveMetadata = (project: IProject, graph: DeleteGraphResult) => {
    const phaseIds = (project.phases || [])
        .map((phase) => getIdString(phase._id))
        .filter((id): id is string => Boolean(id));
    const phaseRevenueIds = (project.phases || [])
        .map((phase) => getIdString(phase.revenueId))
        .filter((id): id is string => Boolean(id));
    const phaseBankTransactionIds = (project.phases || [])
        .map((phase) => getIdString(phase.bankTransactionId))
        .filter((id): id is string => Boolean(id));
    const phasePaymentBankAccountKeys = Array.from(new Set(
        (project.phases || [])
            .map((phase) => phase.paymentBankAccount)
            .filter((accountKey): accountKey is NonNullable<typeof accountKey> => Boolean(accountKey))
    ));
    const revenueIds = getDeleteGraphNodeIds(graph, 'Revenue', 'project_revenue')
        .map((id) => id.toString());
    const bankTransactionIds = getDeleteGraphNodeIds(graph, 'BankTransaction', 'project_bank_transactions')
        .map((id) => id.toString());

    return {
        projectId: project._id.toString(),
        phaseIds,
        phaseRevenueIds,
        phaseBankTransactionIds,
        phasePaymentBankAccountKeys,
        revenueIds,
        bankTransactionIds,
        affectedCollections: graph.nodes
            .filter((node) => node.count > 0)
            .map((node) => node.sourceCollection),
        externalAssetsRetained: true,
    };
};

const deleteArchivedProjectFinancials = async (
    graph: DeleteGraphResult,
    options: DeleteProjectOptions & { archiveBatchId: string }
): Promise<void> => {
    const transactionIds = getDeleteGraphNodeIds(graph, 'BankTransaction', 'project_bank_transactions');
    const revenueIds = getDeleteGraphNodeIds(graph, 'Revenue', 'project_revenue');

    for (const transactionId of transactionIds) {
        await BankTransactionService.delete(transactionId, {
            archiveBatchId: options.archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Project delete requested',
            skipArchive: true,
            metadata: {
                projectId: graph.rootId.toString(),
                linkedFrom: 'Project',
            },
        });
    }

    if (revenueIds.length > 0) {
        await Revenue.deleteMany({
            _id: { $in: revenueIds },
        });
    }
};

const collectRemovedOrDisabledPhaseFinancialIds = (existingProject: any, incomingPhases: any[]) => {
    const incomingById = new Map(
        incomingPhases
            .map((phase) => [getIdString(phase._id), phase] as const)
            .filter(([id]) => Boolean(id))
    );

    const revenueIds: string[] = [];
    const transactionIds: string[] = [];

    for (const existingPhase of existingProject.phases || []) {
        const existingPhaseId = getIdString(existingPhase._id);
        const incomingPhase = existingPhaseId ? incomingById.get(existingPhaseId) : undefined;
        const shouldRemoveFinancials = !incomingPhase || incomingPhase.hasPayment === false;

        if (!shouldRemoveFinancials) continue;

        const revenueId = getIdString(existingPhase.revenueId);
        const bankTransactionId = getIdString(existingPhase.bankTransactionId);
        if (revenueId) revenueIds.push(revenueId);
        if (bankTransactionId) transactionIds.push(bankTransactionId);
    }

    return { revenueIds, transactionIds };
};

const preserveExistingPhaseFinanceLinks = (existingProject: any, incomingPhases: any[]) => {
    const existingById = new Map<string, any>();
    for (const phase of existingProject.phases || []) {
        const phaseId = getIdString(phase._id);
        if (phaseId) existingById.set(phaseId, phase);
    }

    return incomingPhases.map((phase) => {
        const phaseId = getIdString(phase._id);
        const existingPhase = phaseId ? existingById.get(phaseId) : undefined;
        if (!existingPhase) return phase;

        if (phase.hasPayment === false) {
            const cleaned = { ...phase };
            delete cleaned.revenueId;
            delete cleaned.bankTransactionId;
            delete cleaned.paymentReceivedAmount;
            delete cleaned.paymentExpectedAmountINR;
            delete cleaned.paymentReceivedAmountINR;
            delete cleaned.paymentExchangeRate;
            delete cleaned.paymentExchangeRateDate;
            delete cleaned.paymentSettlementCurrency;
            delete cleaned.paymentFxRateSource;
            delete cleaned.paymentFxRequestedDate;
            delete cleaned.paymentFxFallbackUsed;
            return cleaned;
        }

        return {
            ...phase,
            revenueId: existingPhase.revenueId,
            bankTransactionId: existingPhase.bankTransactionId,
            paymentReceivedAmount: existingPhase.paymentReceivedAmount,
            paymentReceivedAmountINR: existingPhase.paymentReceivedAmountINR,
            paymentSettlementCurrency: existingPhase.paymentSettlementCurrency,
        };
    });
};

const syncLinkedProjectFinancials = async (
    project: any,
    updatedBy: Types.ObjectId
): Promise<void> => {
    await Revenue.updateMany(
        { projectId: project._id },
        { $set: { project: project.name, updatedBy } }
    );

    for (const phase of project.phases || []) {
        const revenueId = getIdString(phase.revenueId);
        const bankTransactionId = getIdString(phase.bankTransactionId);
        if (!revenueId && !bankTransactionId) continue;

        const phaseObjectId = phase._id instanceof Types.ObjectId ? phase._id : new Types.ObjectId(String(phase._id));
        const { amount: expectedAmount, currency } = getPhaseExpectedAmount(phase, project);
        const revenue = revenueId ? await Revenue.findById(revenueId) : null;
        const exchangeRateDate = phase.paymentExchangeRateDate || revenue?.exchangeRateDate || revenue?.date || phase.paymentDueDate || phase.endDate || new Date();
        const storedExchangeRate = Number(
            phase.paymentExchangeRate
            ?? revenue?.exchangeRate
            ?? (currency === 'INR' ? 1 : 0)
        );
        const hasStoredExchangeRate = Number.isFinite(storedExchangeRate) && storedExchangeRate > 0;
        const amountINR = expectedAmount > 0 && hasStoredExchangeRate
            ? roundMoney(expectedAmount * storedExchangeRate)
            : roundMoney(Number(revenue?.amountINR ?? phase.paymentExpectedAmountINR ?? 0));
        const receivedAmount = roundMoney(Number(phase.paymentReceivedAmountINR ?? phase.paymentReceivedAmount ?? revenue?.receivedAmount ?? 0));
        const gstApplicable = phase.gstApplicable ?? revenue?.gstApplicable ?? true;
        const gstRate = phase.gstRate ?? revenue?.gstRate ?? 18;
        const gst = gstApplicable ? roundMoney((amountINR * gstRate) / 100) : 0;
        const tdsDeducted = roundMoney(Number(phase.tdsDeducted ?? revenue?.tdsDeducted ?? 0));
        const totalAmount = roundMoney(amountINR + gst - tdsDeducted);
        const dueDate = phase.paymentDueDate || phase.endDate;
        const description = `Payment for ${project.name} - ${phase.name}`;

        if (revenue) {
            revenue.project = project.name;
            revenue.phaseId = phaseObjectId;
            revenue.description = description;
            revenue.amount = expectedAmount || revenue.amount;
            revenue.currency = currency as any;
            revenue.exchangeRate = hasStoredExchangeRate ? storedExchangeRate : revenue.exchangeRate;
            revenue.exchangeRateDate = exchangeRateDate ? new Date(exchangeRateDate) : revenue.exchangeRateDate;
            revenue.exchangeRateProvider = revenue.exchangeRateProvider || 'frankfurter';
            revenue.amountINR = amountINR;
            revenue.gstApplicable = gstApplicable;
            revenue.gstRate = gstRate;
            revenue.gst = gst;
            revenue.tdsDeducted = tdsDeducted;
            revenue.totalAmount = totalAmount;
            revenue.receivedAmount = receivedAmount;
            revenue.pendingAmount = Math.max(0, roundMoney(totalAmount - receivedAmount));
            revenue.status = getRevenueStatus(totalAmount, receivedAmount, dueDate ? new Date(dueDate) : undefined);
            revenue.updatedBy = updatedBy;
            await revenue.save();
        }

        if (bankTransactionId && receivedAmount > 0) {
            await BankTransactionService.update(bankTransactionId, {
                accountKey: phase.paymentBankAccount || 'hdfc_gst',
                transactionType: 'credit',
                amount: receivedAmount,
                date: revenue?.date || new Date(exchangeRateDate),
                description: `Payment received: ${project.name} - ${phase.name}`,
                referenceNumber: `PHASE-${String(phase._id).slice(-8)}`,
                notes: `Auto-generated from project phase payment`,
                source: 'automatic',
                projectId: project._id,
                phaseId: phaseObjectId,
                revenueId: revenue?._id,
                updatedBy,
            });
        }
    }
};

// ─── Helper: auto-add project to user's projectPermissions (all tabs false) ──

const defaultProjectPerm = (projectId: string) => ({
    projectId,
    subModules: {
        overview: true, tasks: true, timeLogs: true,
        meetings: true, credentials: true, documents: true, notes: true,
    },
});

async function ensureProjectInPermissions(userId: string, projectId: string, subModules?: any): Promise<void> {
    const permToInsert = subModules
        ? { projectId, subModules }
        : defaultProjectPerm(projectId);

    // First, ensure projectManagement module is enabled
    await User.updateOne(
        { _id: userId },
        { $set: { 'modulePermissions.projectManagement.enabled': true } }
    );

    // Then add the project to permissions if not already present
    await User.updateOne(
        {
            _id: userId,
            'modulePermissions.projectManagement.projectPermissions.projectId': { $ne: projectId },
        },
        {
            $push: {
                'modulePermissions.projectManagement.projectPermissions': permToInsert,
            },
        }
    );
}

function serializeAssignee(assignee: any) {
    const employee = assignee?.employeeId && typeof assignee.employeeId === 'object' ? assignee.employeeId : null;
    const partnerEmployee = assignee?.partnerEmployeeId && typeof assignee.partnerEmployeeId === 'object'
        ? assignee.partnerEmployeeId
        : null;
    const partner = assignee?.partnerId && typeof assignee.partnerId === 'object' ? assignee.partnerId : null;
    const employeeUser = employee?.userId && typeof employee.userId === 'object' ? employee.userId : null;
    const plainUser = assignee?.userId && typeof assignee.userId === 'object' ? assignee.userId : null;
    const normalizedUserRole = String((plainUser as any)?.role?.name || (plainUser as any)?.role || '').toLowerCase();
    const isProtected = assignee?.memberType === 'partner' || ['super-admin', 'super_admin'].includes(normalizedUserRole);

    if (assignee?.memberType === 'partner' || partner) {
        const partnerUser = partner?.userId && typeof partner.userId === 'object' ? partner.userId : null;

        return {
            ...assignee,
            memberId: partner?._id?.toString() || assignee?.partnerId?.toString?.() || plainUser?._id?.toString?.() || assignee?.userId?.toString?.() || '',
            displayName: partnerUser?.name || partner?.contactPerson || partner?.companyName || 'Partner',
            displayEmail: partnerUser?.email || partner?.email || '',
            displayDesignation: 'Partner Admin',
            displayCode: 'Partner',
            sourceType: 'partner',
            sourceLabel: 'Partner',
            protectedFromRemoval: isProtected,
        };
    }

    if (assignee?.memberType === 'partner-employee' || partnerEmployee) {
        return {
            ...assignee,
            memberId: partnerEmployee?._id?.toString() || assignee?.partnerEmployeeId?.toString?.() || '',
            displayName: partnerEmployee?.name || 'Partner Team Member',
            displayEmail: partnerEmployee?.email || '',
            displayDesignation: partnerEmployee?.designation || '',
            displayCode: 'Partner',
            sourceType: 'partner',
            sourceLabel: 'Partner Team',
            protectedFromRemoval: isProtected,
        };
    }

    return {
        ...assignee,
        memberId: employee?._id?.toString() || assignee?.employeeId?.toString?.() || plainUser?._id?.toString?.() || assignee?.userId?.toString?.() || '',
        displayName: employeeUser?.name || plainUser?.name || 'Creative Upaay Member',
        displayEmail: employeeUser?.email || plainUser?.email || '',
        displayDesignation: employee?.designation || '',
        displayCode: 'CU',
        sourceType: 'cu',
        sourceLabel: 'Creative Upaay',
        protectedFromRemoval: isProtected,
    };
}

function serializeProjectAssignees(project: any) {
    if (!project?.assignees) return project;

    return {
        ...project,
        assignees: project.assignees.map((assignee: any) => serializeAssignee(assignee)),
    };
}

async function attachComputedOverdueDate(projects: any | any[]): Promise<any> {
    const arr = Array.isArray(projects) ? projects : [projects];
    if (arr.length === 0) return projects;

    const projectIds = arr
        .map((project) => project?._id?.toString())
        .filter(Boolean);

    if (projectIds.length === 0) return projects;

    const taskDeadlines = await Task.aggregate([
        {
            $match: {
                projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) },
                deadline: { $ne: null },
            },
        },
        {
            $group: {
                _id: '$projectId',
                latestTaskDeadline: { $max: '$deadline' },
            },
        },
    ]);

    const taskDeadlineMap = new Map<string, string>(
        taskDeadlines.map((entry: any) => [entry._id.toString(), entry.latestTaskDeadline?.toISOString?.() || String(entry.latestTaskDeadline)])
    );

    const withOverdueDate = arr.map((project) => {
        const baseDeadline = project?.endDate || project?.deadline || null;
        const latestTaskDeadline = taskDeadlineMap.get(project._id.toString());

        let overdueDate = baseDeadline;
        if (latestTaskDeadline) {
            if (!overdueDate) {
                overdueDate = latestTaskDeadline;
            } else if (new Date(latestTaskDeadline).getTime() > new Date(overdueDate).getTime()) {
                overdueDate = latestTaskDeadline;
            }
        }

        return {
            ...project,
            overdueDate,
        };
    });

    return Array.isArray(projects) ? withOverdueDate : withOverdueDate[0];
}

function normalizeLegacyAssignees(project: any) {
    if (!project?.assignees?.length) return;

    project.assignees.forEach((assignee: any) => {
        if (!assignee.memberType) {
            assignee.memberType = assignee.partnerId ? 'partner' : assignee.partnerEmployeeId ? 'partner-employee' : 'employee';
        }
    });
}

const getSuperadminUserIds = async (): Promise<string[]> => {
    const superadminRoles = await Role.find({
        name: { $in: ['super-admin', 'super_admin', 'superadmin'] },
    }).select('_id').lean();

    if (!superadminRoles.length) {
        return [];
    }

    const superadmins = await User.find({
        role: { $in: superadminRoles.map((role) => role._id) },
        isActive: true,
    }).select('_id').lean();

    if (!superadmins.length) {
        return [];
    }

    const employeeBackedSuperadmins = await Employee.find({
        userId: { $in: superadmins.map((user) => user._id) },
    }).select('userId').lean();

    return employeeBackedSuperadmins.map((employee) => employee.userId.toString());
};

const buildInternalAssignee = async (
    userId: string,
    assignedBy: string,
    role: 'admin' | 'manager' | 'developer' | 'designer' | 'qa' | 'viewer' | 'member',
    isSystemManaged: boolean
) => {
    const employee = await Employee.findOne({ userId }).select('_id userId').lean();

    return {
        ...(employee?._id ? { employeeId: new Types.ObjectId(employee._id.toString()) } : {}),
        memberType: 'employee' as const,
        userId: new Types.ObjectId(userId),
        role,
        isSystemManaged,
        assignedBy: new Types.ObjectId(assignedBy),
        assignedAt: new Date(),
    };
};

/**
 * Create a new project
 */
export const createProject = async (
    data: CreateProjectData
): Promise<IProject> => {
    const initialAssignees = data.assignees?.map((a) => ({
        ...a,
        assignedBy: data.createdBy,
        assignedAt: new Date(),
    })) || [];

    const seenUserIds = new Set(
        initialAssignees
            .map((assignee) => assignee.userId?.toString())
            .filter(Boolean)
    );

    const pushUniqueAssignee = (assignee: any) => {
        const assigneeUserId = assignee.userId?.toString();
        if (assigneeUserId && seenUserIds.has(assigneeUserId)) {
            return;
        }

        if (assigneeUserId) {
            seenUserIds.add(assigneeUserId);
        }

        initialAssignees.push(assignee);
    };

    pushUniqueAssignee(await buildInternalAssignee(data.createdBy, data.createdBy, 'admin', false));

    const superadminUserIds = await getSuperadminUserIds();
    for (const superadminUserId of superadminUserIds) {
        pushUniqueAssignee(await buildInternalAssignee(superadminUserId, data.createdBy, 'admin', true));
    }

    if (data.partnerId) {
        const partner = await Partner.findById(data.partnerId).select('_id userId').lean();
        const partnerUserId = partner?.userId?.toString();

        if (partner && partnerUserId) {
            pushUniqueAssignee({
                partnerId: new Types.ObjectId(partner._id.toString()),
                memberType: 'partner' as const,
                userId: new Types.ObjectId(partnerUserId),
                role: 'admin' as const,
                isSystemManaged: true,
                assignedBy: new Types.ObjectId(data.createdBy),
                assignedAt: new Date(),
            });
        }
    }

    const projectData: any = {
        ...data,
        // Automatically grant the creator full credential-admin access
        credentialAdmins: [new Types.ObjectId(data.createdBy)],
        assignees: initialAssignees,
    };

    if (Array.isArray(projectData.phases)) {
        projectData.phases = await normalizePhasePaymentFinancials(projectData, projectData.phases);
    }

    const project = await Project.create(projectData);

    // Auto-create the client-shared "Shared Files" folder for every new project
    await DocFolder.create({
        projectId: project._id,
        name: 'Shared Files',
        parentId: null,
        createdBy: new Types.ObjectId(data.createdBy),
        viewAccess: [],
        isSystem: true,
        isClientShared: true,
        isPartnerShared: true,
    });

    // Auto-populate projectPermissions for all initial assignees
    if (data.assignees && data.assignees.length > 0) {
        // Fetch employees to get their userIds
        const employeeIds = data.assignees
            .filter((a) => a.memberType === 'employee' && a.employeeId)
            .map((a) => a.employeeId as string);
        const employees = await Employee.find({ _id: { $in: employeeIds } }).lean();

        const employeeUserMap = new Map(
            employees.map(emp => [emp._id.toString(), (emp.userId as any).toString()])
        );

        await Promise.all(
            data.assignees.map(a => {
                if (a.memberType !== 'employee' || !a.employeeId) {
                    return Promise.resolve();
                }

                const uId = employeeUserMap.get(a.employeeId);
                if (uId) {
                    return ensureProjectInPermissions(uId, (project._id as any).toString(), a.subModules);
                }
                return Promise.resolve();
            })
        );
    }

    return project;
};

/**
 * Get all projects (filtered by user access)
 */
export const getProjects = async (
    userId: string,
    userRole: string,
    filters?: {
        status?: string;
        clientId?: string;
        priority?: string;
        partnerId?: string;
    },
    projectAccess?: 'all' | 'assigned' | 'custom',
    projectIds?: string[],
    requesterPartnerId?: string,
    requesterIsPartnerEmployee?: boolean
): Promise<IProject[]> => {
    const query: any = { isArchived: false };

    // Apply filters
    if (filters?.status) query.status = filters.status;
    if (filters?.clientId) query.clientId = filters.clientId;
    if (filters?.priority) query.priority = filters.priority;
    if (requesterPartnerId) {
        query.partnerId = new Types.ObjectId(requesterPartnerId);
        if (requesterIsPartnerEmployee) {
            query['assignees.partnerEmployeeId'] = new Types.ObjectId(userId);
        }
    }

    const normalizedRole = userRole?.toLowerCase();
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'super-admin' || normalizedRole === 'super_admin';

    if (!requesterPartnerId && filters?.partnerId && isAdmin) {
        query.partnerId = new Types.ObjectId(filters.partnerId);
    }

    if (!isAdmin && !requesterPartnerId) {
        const access = projectAccess ?? 'assigned';
        if (access === 'all') {
            // No restriction — show everything
        } else if (access === 'custom' && projectIds && projectIds.length > 0) {
            // Only the explicitly whitelisted project IDs
            query['_id'] = { $in: projectIds };
        } else {
            // Default 'assigned' — only projects where user's employeeId is an assignee
            const employee = await Employee.findOne({ userId }).lean();
            if (employee) {
                query['assignees.employeeId'] = employee._id;
            } else {
                // Return no projects if user isn't an employee
                query['assignees.employeeId'] = null;
            }
        }
    }

    const projects = await Project.find(query)
        .populate('clientId', 'name email')
        .populate({
            path: 'partnerId',
            select: 'companyName contactPerson userId',
            populate: { path: 'userId', select: 'name email' }
        })
        .populate({
            path: 'assignees.employeeId',
            select: 'designation department',
            populate: { path: 'userId', select: 'name email role' } // Get user info through employee
        })
        .populate('assignees.userId', 'name email role')
        .populate({
            path: 'assignees.partnerId',
            select: 'companyName contactPerson email userId',
            populate: { path: 'userId', select: 'name email role' }
        })
        .populate('assignees.partnerEmployeeId', 'name email designation phone isActive')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();

    const serializedProjects = projects.map((project: any) => serializeProjectAssignees(project));
    return attachComputedOverdueDate(serializedProjects) as any;
};

/**
 * Get project by ID
 */
export const getProjectById = async (
    projectId: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId)
        .populate('clientId', 'name email phone')
        .populate({
            path: 'partnerId',
            select: 'companyName contactPerson userId',
            populate: { path: 'userId', select: 'name email' }
        })
        .populate({
            path: 'assignees.employeeId',
            select: 'designation department',
            populate: { path: 'userId', select: 'name email role' }
        })
        .populate('assignees.userId', 'name email role')
        .populate({
            path: 'assignees.partnerId',
            select: 'companyName contactPerson email userId',
            populate: { path: 'userId', select: 'name email role' }
        })
        .populate('assignees.partnerEmployeeId', 'name email designation phone isActive')
        .populate('createdBy', 'name email')
        .populate('documents.uploadedBy', 'name email')
        .lean();

    if (!project) return null;

    const serializedProject = serializeProjectAssignees(project);
    return attachComputedOverdueDate(serializedProject) as any;
};

/**
 * Update project
 */
export const updateProject = async (
    projectId: string,
    data: UpdateProjectData,
    updatedBy?: string
): Promise<IProject | null> => {
    const existingProject = await Project.findById(projectId);
    if (!existingProject) return null;

    const dataToSave: UpdateProjectData = { ...data };
    const removedOrDisabledFinancials = Array.isArray(data.phases)
        ? collectRemovedOrDisabledPhaseFinancialIds(existingProject, data.phases)
        : { revenueIds: [], transactionIds: [] };

    if (Array.isArray(data.phases)) {
        dataToSave.phases = preserveExistingPhaseFinanceLinks(existingProject, data.phases);
        const projectDraft = {
            ...(existingProject.toObject ? existingProject.toObject() : existingProject),
            ...dataToSave,
        };
        dataToSave.phases = await normalizePhasePaymentFinancials(projectDraft, dataToSave.phases, existingProject);
    }

    const project = await Project.findByIdAndUpdate(
        projectId,
        { $set: dataToSave },
        { new: true, runValidators: true }
    );

    if (!project) return null;

    for (const transactionId of new Set(removedOrDisabledFinancials.transactionIds)) {
        await deleteBankTransactionAndAdjustBalance(transactionId);
    }

    if (removedOrDisabledFinancials.revenueIds.length > 0) {
        await Revenue.deleteMany({
            _id: { $in: removedOrDisabledFinancials.revenueIds.map((id) => new Types.ObjectId(id)) },
        });
    }

    if (updatedBy) {
        await syncLinkedProjectFinancials(project, new Types.ObjectId(updatedBy));
    }

    return project;
};

/**
 * Delete project (soft delete)
 */
export const deleteProject = async (
    projectId: string,
    options: DeleteProjectOptions = {}
): Promise<IProject | null> => {
    const existingProject = await Project.findById(projectId);
    if (!existingProject) return null;

    const archiveBatchId = options.archiveBatchId ?? DeletedRecordService.generateArchiveBatchId();
    const graphPreview = await DeleteGraphService.discoverGraph('Project', existingProject._id, {
        archiveBatchId,
    });
    const metadata = buildProjectArchiveMetadata(existingProject, graphPreview);
    const graph = await DeleteGraphService.archiveGraph('Project', existingProject._id, {
        archiveBatchId,
        deletedBy: options.deletedBy,
        reason: options.reason ?? 'Project delete requested',
        metadata,
    });

    await deleteArchivedProjectFinancials(graph, {
        ...options,
        archiveBatchId,
    });

    const project = await Project.findByIdAndUpdate(
        projectId,
        { $set: { isArchived: true } },
        { new: true }
    );

    return project;
};

/**
 * Add assignee to project
 */
export const addAssignee = async (
    projectId: string,
    memberId: string,
    memberType: 'employee' | 'partner-employee' | 'partner',
    role: 'admin' | 'manager' | 'developer' | 'designer' | 'qa' | 'viewer' | 'member',
    assignedBy: string,
    subModules?: any,
    requesterPartnerId?: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // Older projects may still have assignees from before memberType existed.
    // Normalize them before saving so adding a new member doesn't fail validation.
    normalizeLegacyAssignees(project);

    // Check if employee is already assigned
    const existingAssignee = project.assignees.find((a) => {
        if (memberType === 'partner') {
            return a.partnerId?.toString() === memberId || a.userId?.toString() === memberId;
        }
        if (memberType === 'partner-employee') {
            return a.partnerEmployeeId?.toString() === memberId;
        }

        return a.employeeId?.toString() === memberId;
    });

    if (existingAssignee) {
        throw new AppError('Employee is already assigned to this project', 400);
    }

    if (memberType === 'partner-employee') {
        const { PartnerEmployee } = await import('../../partners/models/PartnerEmployee.model');
        const partnerEmployee = await PartnerEmployee.findById(memberId);

        if (!partnerEmployee) {
            throw new AppError('Partner team member not found', 404);
        }

        if (!partnerEmployee.isActive) {
            throw new AppError('This partner team member is inactive', 400);
        }

        const projectPartnerId = project.partnerId?.toString();
        if (!projectPartnerId || projectPartnerId !== partnerEmployee.partnerId.toString()) {
            throw new AppError('Partner team members can only be added to their own partner projects', 400);
        }

        if (requesterPartnerId && requesterPartnerId !== partnerEmployee.partnerId.toString()) {
            throw new AppError('You can only add your own team members to this project', 403);
        }

        project.assignees.push({
            partnerEmployeeId: new Types.ObjectId(memberId),
            memberType,
            userId: new Types.ObjectId(memberId),
            role,
            assignedBy: new Types.ObjectId(assignedBy),
            assignedAt: new Date(),
        });
    } else {
        const employee = await Employee.findById(memberId);
        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        project.assignees.push({
            employeeId: new Types.ObjectId(memberId),
            memberType,
            userId: new Types.ObjectId((employee.userId as any).toString()),
            role,
            assignedBy: new Types.ObjectId(assignedBy),
            assignedAt: new Date(),
        });

        await ensureProjectInPermissions((employee.userId as any).toString(), projectId, subModules);
    }

    await project.save();

    return getProjectById(projectId) as any;
};

/**
 * Remove assignee from project
 */
export const removeAssignee = async (
    projectId: string,
    memberId: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    normalizeLegacyAssignees(project);

    const assigneeToRemove = project.assignees.find(
        (a) =>
            a.employeeId?.toString() === memberId ||
            a.partnerEmployeeId?.toString() === memberId ||
            a.partnerId?.toString() === memberId ||
            a.userId?.toString() === memberId
    );

    if (assigneeToRemove?.memberType === 'partner' || assigneeToRemove?.isSystemManaged) {
        throw new AppError('This project admin is added automatically and cannot be removed', 403);
    }

    project.assignees = project.assignees.filter(
        (a) =>
            a.employeeId?.toString() !== memberId &&
            a.partnerEmployeeId?.toString() !== memberId &&
            a.partnerId?.toString() !== memberId &&
            a.userId?.toString() !== memberId
    );

    await project.save();

    // Pull the project completely from the user's personal modulePermissions
    // This ensures it is hidden from the user's dashboard
    if (assigneeToRemove?.memberType === 'employee') {
        // Resolve the userId to clean from modulePermissions.
        // The employee record might not exist if they were hard-deleted from the platform.
        let userIdToClean: string | null = null;

        if (assigneeToRemove.employeeId) {
            const employee = await Employee.findById(assigneeToRemove.employeeId)
                .select('userId').lean();
            userIdToClean = employee
                ? (employee.userId as any)?.toString?.() ?? null
                : assigneeToRemove.userId?.toString?.() ?? null;
        } else {
            userIdToClean = assigneeToRemove.userId?.toString?.() ?? null;
        }

        if (userIdToClean) {
            await User.updateOne(
                { _id: userIdToClean },
                {
                    $pull: {
                        'modulePermissions.projectManagement.projectPermissions': { projectId }
                    }
                }
            );
        }
    }
    return getProjectById(projectId) as any;
};

/**
 * Update assignee permissions (sub modules)
 */
export const updateAssigneePermissions = async (
    employeeId: string,
    projectId: string,
    subModules: any
): Promise<void> => {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new AppError('Employee not found', 404);
    const userId = (employee.userId as any).toString();

    // First ensure the user has the project in their permissions array
    await ensureProjectInPermissions(userId, projectId, subModules);

    // Then update the specific subModules if it was already there
    await User.updateOne(
        {
            _id: userId,
            'modulePermissions.projectManagement.projectPermissions.projectId': projectId
        },
        {
            $set: { 'modulePermissions.projectManagement.projectPermissions.$.subModules': subModules }
        }
    );
};

/**
 * Get assignee permissions (sub modules)
 */
export const getAssigneePermissions = async (
    employeeId: string,
    projectId: string
): Promise<any> => {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new AppError('Employee not found', 404);

    const user = await User.findById(employee.userId);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    const projectPerms = user.modulePermissions?.projectManagement?.projectPermissions || [];
    const perm = projectPerms.find((p: any) => p.projectId.toString() === projectId);

    return perm ? perm.subModules : defaultProjectPerm(projectId).subModules;
};

/**
 * Upload document to project
 */
export const uploadProjectDocument = async (
    projectId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    documentType: 'contract' | 'proposal' | 'invoice' | 'other',
    uploadedBy: string
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // Upload to Cloudinary
    const folder = `projects/${projectId}/documents`;
    const uploadResult = await uploadDocument(fileBuffer, folder, fileName);

    // Add document to project
    project.documents.push({
        _id: new Types.ObjectId(),
        name: fileName,
        type: documentType,
        cloudinaryId: uploadResult.cloudinaryId,
        uploadedBy: new Types.ObjectId(uploadedBy),
        uploadedAt: new Date(),
        size: uploadResult.size,
    });

    await project.save();
    return project;
};

/**
 * Get signed URL for document
 */
export const getProjectDocument = async (
    projectId: string,
    documentId: string
): Promise<string> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    const document = project.documents.find(
        (doc) => doc._id.toString() === documentId
    );

    if (!document) {
        throw new AppError('Document not found', 404);
    }

    // Generate signed URL (expires in 1 hour)
    const signedUrl = getSignedUrl(document.cloudinaryId, 3600);
    return signedUrl;
};

/**
 * Delete document from project
 */
export const deleteProjectDocument = async (
    projectId: string,
    documentId: string,
    options: { deletedBy?: string; reason?: string } = {}
): Promise<IProject | null> => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    const document = project.documents.find(
        (doc) => doc._id.toString() === documentId
    );

    if (!document) {
        throw new AppError('Document not found', 404);
    }

    await DeletedRecordService.archiveDocument(project, {
        deletedBy: options.deletedBy,
        reason: options.reason ?? 'Project embedded document delete requested',
        operation: 'external_retention',
        metadata: {
            projectId: project._id.toString(),
            documentId,
            documentSnapshot: JSON.parse(JSON.stringify(document)),
            cloudinaryId: document.cloudinaryId,
            name: document.name,
            size: document.size,
            type: document.type,
            uploadedBy: document.uploadedBy?.toString(),
            uploadedAt: document.uploadedAt?.toISOString(),
            externalAssetRetained: true,
            externalAssetRetentionPolicy: 'Retain Cloudinary/local file during 30-day archive window.',
        },
    });

    // Remove from project
    project.documents = project.documents.filter(
        (doc) => doc._id.toString() !== documentId
    );

    await project.save();
    return project;
};
