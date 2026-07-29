import { Types } from 'mongoose';
import AppError from '../../../utils/appError';
import { Reimbursement, IPolicyFlag } from '../models/Reimbursement.model';
import { Employee } from '../models/Employee.model';
import { uploadDocument, deleteDocument } from '../../../utils/cloudinary.util';
import { ExpenseService } from '../../finance/services/expense.service';
import { Expense } from '../../finance/models/Expense.model';
import type { CreateReimbursementInput, UpdateReimbursementInput, UpdateReimbursementStatusInput } from '../validators/reimbursement.validator';



// ── Claim ID generator ────────────────────────────────────────────────
async function generateClaimId(): Promise<string> {
    const last = await Reimbursement.findOne({}, { claimId: 1 })
        .sort({ createdAt: -1 })
        .lean();

    if (!last?.claimId) return 'RE-1001';

    const match = last.claimId.match(/RE-(\d+)/);
    if (!match) return 'RE-1001';

    const next = parseInt(match[1], 10) + 1;
    return `RE-${next}`;
}

// ── Policy checker ────────────────────────────────────────────────────
function runPolicyChecks(params: {
    category: string;
    amount: number;
    expenseDate: Date;
    hasReceipt: boolean;
}): IPolicyFlag[] {
    const { category, amount, expenseDate, hasReceipt } = params;
    const flags: IPolicyFlag[] = [];

    // Receipt check
    flags.push({
        rule: 'receipt_required',
        status: hasReceipt ? 'pass' : 'warn',
        message: hasReceipt ? 'Receipt attached' : 'Receipt not attached — required for approval',
    });

    // Expense age check (>30 days)
    const daysSinceExpense = Math.floor(
        (Date.now() - new Date(expenseDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceExpense > 30) {
        flags.push({
            rule: 'expense_age',
            status: 'warn',
            message: `Expense is ${daysSinceExpense} days old — claims older than 30 days may require justification`,
        });
    } else {
        flags.push({
            rule: 'expense_age',
            status: 'pass',
            message: 'Expense submitted within 30 days',
        });
    }



    return flags;
}

// ── Create reimbursement (draft) ──────────────────────────────────────
export async function createReimbursement(
    userId: string,
    data: CreateReimbursementInput
) {
    const employee = await Employee.findOne({ userId });
    if (!employee) {
        throw new AppError('Employee profile not found', 404);
    }

    const claimId = await generateClaimId();

    const policyFlags = runPolicyChecks({
        category: data.category,
        amount: data.amount,
        expenseDate: new Date(data.expenseDate),
        hasReceipt: false,
    });

    const reimbursement = await Reimbursement.create({
        claimId,
        employeeId: employee._id,
        title: data.title,
        category: data.category,
        expenseDate: new Date(data.expenseDate),
        amount: data.amount,
        merchant: data.merchant,
        businessPurpose: data.businessPurpose,
        level: data.level || 'company',
        projectId: data.projectId,
        status: 'draft',
        policyFlags,
        activityLog: [
            {
                action: 'Reimbursement created as draft',
                actorId: new Types.ObjectId(userId),
                actorName: 'You',
                timestamp: new Date(),
            },
        ],
        createdBy: new Types.ObjectId(userId),
    });

    return reimbursement;
}

// ── Upload receipt ────────────────────────────────────────────────────
export async function uploadReceipt(
    userId: string,
    reimbursementId: string,
    file: Express.Multer.File
) {
    const reimbursement = await Reimbursement.findById(reimbursementId);
    if (!reimbursement) throw new AppError('Reimbursement not found', 404);

    const employee = await Employee.findOne({ userId });
    if (!employee) throw new AppError('Employee profile not found', 404);

    // Only owner can upload (or admin)
    if (reimbursement.employeeId.toString() !== employee._id.toString()) {
        throw new AppError('Not authorized to update this claim', 403);
    }

    if (!['draft', 'changes_requested', 'pending'].includes(reimbursement.status)) {
        throw new AppError('Receipt can only be changed on draft, pending, or changes_requested claims', 400);
    }

    // Delete old receipt if exists
    if (reimbursement.receipt?.cloudinaryId) {
        await deleteDocument(reimbursement.receipt.cloudinaryId).catch(() => { /* best-effort */ });
    }

    const folder = `hrms/reimbursements/${reimbursement._id}`;
    const result = await uploadDocument(file.buffer, folder, file.originalname, false);

    reimbursement.receipt = {
        cloudinaryId: result.cloudinaryId,
        url: result.url,
        format: result.format,
        size: result.size,
        originalName: file.originalname,
    };

    // Re-run policy checks with receipt now present
    reimbursement.policyFlags = runPolicyChecks({
        category: reimbursement.category,
        amount: reimbursement.amount,
        expenseDate: reimbursement.expenseDate,
        hasReceipt: true,
    });

    await reimbursement.save();
    return reimbursement;
}

// ── Submit draft ──────────────────────────────────────────────────────
export async function submitReimbursement(userId: string, reimbursementId: string) {
    // Do NOT populate here — we need raw ObjectId for comparison
    const reimbursement = await Reimbursement.findById(reimbursementId);

    if (!reimbursement) throw new AppError('Reimbursement not found', 404);

    const employee = await Employee.findOne({ userId });
    if (!employee) throw new AppError('Employee profile not found', 404);

    // Compare raw ObjectIds (employeeId is stored as ObjectId when not populated)
    if (reimbursement.employeeId.toString() !== employee._id.toString()) {
        throw new AppError('Not authorized to submit this claim', 403);
    }

    if (!['draft', 'changes_requested'].includes(reimbursement.status)) {
        throw new AppError('Only draft or changes_requested claims can be submitted', 400);
    }

    const now = new Date();
    reimbursement.status = 'pending';
    reimbursement.submittedAt = now;

    // Update timeline: mark Submitted as approved
    if (reimbursement.approvalTimeline[0]) {
        reimbursement.approvalTimeline[0].status = 'approved';
        reimbursement.approvalTimeline[0].timestamp = now;
    }

    // Re-run policy checks
    reimbursement.policyFlags = runPolicyChecks({
        category: reimbursement.category,
        amount: reimbursement.amount,
        expenseDate: reimbursement.expenseDate,
        hasReceipt: !!reimbursement.receipt?.cloudinaryId,
    });

    reimbursement.activityLog.push({
        action: 'Reimbursement submitted for approval',
        actorId: new Types.ObjectId(userId),
        actorName: 'You',
        timestamp: now,
    } as any);

    await reimbursement.save();
    return reimbursement;
}

// ── Update draft / changes_requested ─────────────────────────────────
export async function updateReimbursement(
    userId: string,
    reimbursementId: string,
    data: UpdateReimbursementInput,
    isAdmin = false
) {
    const reimbursement = await Reimbursement.findById(reimbursementId);
    if (!reimbursement) throw new AppError('Reimbursement not found', 404);

    if (!isAdmin) {
        const employee = await Employee.findOne({ userId });
        if (!employee || reimbursement.employeeId.toString() !== employee._id.toString()) {
            throw new AppError('Not authorized to edit this claim', 403);
        }
        if (!['draft', 'changes_requested', 'pending'].includes(reimbursement.status)) {
            throw new AppError('Only draft, pending, or changes_requested claims can be edited', 400);
        }
    }

    if (data.title !== undefined) reimbursement.title = data.title;
    if (data.category !== undefined) reimbursement.category = data.category;
    if (data.expenseDate !== undefined) reimbursement.expenseDate = new Date(data.expenseDate);
    if (data.amount !== undefined) reimbursement.amount = data.amount;
    if (data.merchant !== undefined) reimbursement.merchant = data.merchant;
    if (data.businessPurpose !== undefined) reimbursement.businessPurpose = data.businessPurpose;
    if (data.level !== undefined) reimbursement.level = data.level as any;
    if (data.projectId !== undefined) reimbursement.projectId = data.projectId as any;

    // Re-run policy checks
    reimbursement.policyFlags = runPolicyChecks({
        category: reimbursement.category,
        amount: reimbursement.amount,
        expenseDate: reimbursement.expenseDate,
        hasReceipt: !!reimbursement.receipt?.cloudinaryId,
    });

    await reimbursement.save();
    return reimbursement;
}

// ── Admin: update status ──────────────────────────────────────────────
export async function updateReimbursementStatus(
    adminUserId: string,
    adminName: string,
    reimbursementId: string,
    data: UpdateReimbursementStatusInput
) {
    const reimbursement = await Reimbursement.findById(reimbursementId);
    if (!reimbursement) throw new AppError('Reimbursement not found', 404);

    if (!['pending', 'approved'].includes(reimbursement.status)) {
        throw new AppError(`Cannot update status of a ${reimbursement.status} claim`, 400);
    }

    const prevStatus = reimbursement.status;
    reimbursement.status = data.status as any;
    const now = new Date();

    // Update approval timeline
    if (data.status === 'approved' || data.status === 'changes_requested' || data.status === 'rejected') {
        const approvalStep = reimbursement.approvalTimeline[1];
        if (approvalStep) {
            approvalStep.status = data.status === 'approved' ? 'approved' : data.status === 'rejected' ? 'rejected' : 'changes_requested';
            approvalStep.actorId = new Types.ObjectId(adminUserId);
            approvalStep.actorName = adminName;
            approvalStep.comment = data.comment;
            approvalStep.timestamp = now;
        }
    }

    if (data.status === 'paid') {
        reimbursement.paymentInfo = {
            method: data.paymentMethod === 'cash' ? 'cash' : 'bank_transfer',
            reference: data.paymentReference,
            paidAt: now,
        };

        const paymentStep = reimbursement.approvalTimeline[2];
        if (paymentStep) {
            paymentStep.status = 'approved';
            paymentStep.actorId = new Types.ObjectId(adminUserId);
            paymentStep.actorName = adminName;
            paymentStep.comment = data.comment;
            paymentStep.timestamp = now;
        }

        if (data.syncToFinance) {
            const existingExpense = await Expense.findOne({ reimbursementId: reimbursement._id });
            
            if (!existingExpense) {
                const expensePaymentMethod = data.paymentMethod === 'cash' ? 'cash' : 'bank_transfer';

                await ExpenseService.create({
                    date: now,
                    description: `Reimbursement: ${reimbursement.title}`,
                    category: 'Reimbursements',
                    level: reimbursement.level || 'company',
                    projectId: reimbursement.projectId,
                    type: 'variable',
                    amount: reimbursement.amount,
                    employeeId: reimbursement.employeeId,
                    reimbursementId: reimbursement._id,
                    paidBy: adminName,
                    sourceAccountKey: data.paymentMethod as any,
                    paymentMethod: expensePaymentMethod,
                    transactionRef: data.paymentReference,
                    notes: 'Auto-synced from HRMS Reimbursements.',
                    createdBy: new Types.ObjectId(adminUserId),
                } as any);
            }
        }
    }

    const actionLabels: Record<string, string> = {
        approved: 'Claim approved',
        rejected: 'Claim rejected',
        changes_requested: 'Changes requested',
        paid: 'Payment marked',
    };

    reimbursement.activityLog.push({
        action: actionLabels[data.status] || data.status,
        actorId: new Types.ObjectId(adminUserId),
        actorName: adminName,
        comment: data.comment,
        timestamp: now,
    } as any);

    await reimbursement.save();
    return { reimbursement, prevStatus };
}

// ── Get my reimbursements (employee) ─────────────────────────────────
export async function getMyReimbursements(
    userId: string,
    params: {
        status?: string;
        category?: string;
        startDate?: string;
        endDate?: string;
        policy?: string;
        sort?: string;
        page?: number;
        limit?: number;
    }
) {
    const employee = await Employee.findOne({ userId });
    if (!employee) throw new AppError('Employee profile not found', 404);

    const filter: Record<string, any> = { employeeId: employee._id };

    if (params.status && params.status !== 'all') {
        filter.status = params.status;
    }
    if (params.category) {
        filter.category = params.category;
    }
    if (params.startDate || params.endDate) {
        filter.expenseDate = {};
        if (params.startDate) filter.expenseDate.$gte = new Date(params.startDate);
        if (params.endDate) filter.expenseDate.$lte = new Date(params.endDate);
    }

    if (params.policy === 'clean') {
        filter['policyFlags.status'] = { $not: { $in: ['warn', 'fail'] } };
    } else if (params.policy === 'flagged') {
        filter['policyFlags.status'] = { $in: ['warn', 'fail'] };
    }

    let sortObj: any = { createdAt: -1 };
    if (params.sort === 'created_desc') sortObj = { createdAt: -1 };
    else if (params.sort === 'created_asc') sortObj = { createdAt: 1 };
    else if (params.sort === 'amount_desc') sortObj = { amount: -1 };
    else if (params.sort === 'amount_asc') sortObj = { amount: 1 };
    else if (params.sort === 'date_desc') sortObj = { expenseDate: -1 };
    else if (params.sort === 'date_asc') sortObj = { expenseDate: 1 };

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, params.limit || 20);
    const skip = (page - 1) * limit;

    const [reimbursements, total] = await Promise.all([
        Reimbursement.find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .lean(),
        Reimbursement.countDocuments(filter),
    ]);

    return {
        reimbursements,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

// ── Get my summary stats (employee) ──────────────────────────────────
export async function getMyReimbursementSummary(userId: string) {
    const employee = await Employee.findOne({ userId });
    if (!employee) throw new AppError('Employee profile not found', 404);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pending, approved, drafts, paidThisMonth] = await Promise.all([
        Reimbursement.aggregate([
            { $match: { employeeId: employee._id, status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Reimbursement.aggregate([
            { $match: { employeeId: employee._id, status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Reimbursement.countDocuments({ employeeId: employee._id, status: 'draft' }),
        Reimbursement.aggregate([
            {
                $match: {
                    employeeId: employee._id,
                    status: 'paid',
                    'paymentInfo.paidAt': { $gte: monthStart },
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
    ]);

    return {
        pending: { amount: pending[0]?.total || 0, count: pending[0]?.count || 0 },
        approved: { amount: approved[0]?.total || 0, count: approved[0]?.count || 0 },
        paidThisMonth: { amount: paidThisMonth[0]?.total || 0, count: paidThisMonth[0]?.count || 0 },
        drafts: { count: drafts },
    };
}

// ── Get all reimbursements (admin) ────────────────────────────────────
export async function getReimbursements(params: {
    status?: string;
    category?: string;
    department?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    policy?: string;
    sort?: string;
    page?: number;
    limit?: number;
}) {
    const filter: Record<string, any> = {};

    if (params.status && params.status !== 'all') {
        filter.status = params.status;
    }
    if (params.category) {
        filter.category = params.category;
    }
    if (params.startDate || params.endDate) {
        filter.expenseDate = {};
        if (params.startDate) filter.expenseDate.$gte = new Date(params.startDate);
        if (params.endDate) filter.expenseDate.$lte = new Date(params.endDate);
    }
    
    if (params.policy === 'clean') {
        filter['policyFlags.status'] = { $not: { $in: ['warn', 'fail'] } };
    } else if (params.policy === 'flagged') {
        filter['policyFlags.status'] = { $in: ['warn', 'fail'] };
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const skip = (page - 1) * limit;

    // Build the pipeline for search + department filter
    const pipeline: any[] = [
        { $match: filter },
        {
            $lookup: {
                from: 'employees',
                localField: 'employeeId',
                foreignField: '_id',
                as: 'employee',
            },
        },
        { $unwind: { path: '$employee', preserveNullAndEmptyArrays: false } },
        {
            $lookup: {
                from: 'users',
                localField: 'employee.userId',
                foreignField: '_id',
                as: 'user',
            },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
    ];

    if (params.department) {
        pipeline.push({ $match: { 'employee.department': params.department } });
    }

    if (params.search) {
        const regex = new RegExp(params.search, 'i');
        pipeline.push({
            $match: {
                $or: [
                    { 'user.name': { $regex: regex } },
                    { claimId: { $regex: regex } },
                    { title: { $regex: regex } },
                    { merchant: { $regex: regex } },
                ],
            },
        });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    
    let sortObj: any = { createdAt: -1 };
    if (params.sort === 'created_desc') sortObj = { createdAt: -1 };
    else if (params.sort === 'created_asc') sortObj = { createdAt: 1 };
    else if (params.sort === 'amount_desc') sortObj = { amount: -1 };
    else if (params.sort === 'amount_asc') sortObj = { amount: 1 };
    else if (params.sort === 'date_desc') sortObj = { expenseDate: -1 };
    else if (params.sort === 'date_asc') sortObj = { expenseDate: 1 };

    pipeline.push(
        { $sort: sortObj },
        { $skip: skip },
        { $limit: limit },
        {
            $project: {
                claimId: 1, title: 1, category: 1, amount: 1, status: 1,
                expenseDate: 1, submittedAt: 1, createdAt: 1, receipt: 1,
                policyFlags: 1, merchant: 1, businessPurpose: 1,
                employeeId: 1, paymentInfo: 1,
                'employee._id': 1, 'employee.employeeId': 1, 'employee.department': 1, 'employee.designation': 1,
                'user._id': 1, 'user.name': 1, 'user.email': 1,
            },
        }
    );

    const [reimbursements, countResult] = await Promise.all([
        Reimbursement.aggregate(pipeline),
        Reimbursement.aggregate(countPipeline),
    ]);

    return {
        reimbursements,
        pagination: {
            page,
            limit,
            total: countResult[0]?.total || 0,
            pages: Math.ceil((countResult[0]?.total || 0) / limit),
        },
    };
}

// ── Get org-wide summary (admin) ──────────────────────────────────────
export async function getReimbursementSummary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pending, approved, paidThisMonth, changesRequested] = await Promise.all([
        Reimbursement.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Reimbursement.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Reimbursement.aggregate([
            { $match: { status: 'paid', 'paymentInfo.paidAt': { $gte: monthStart } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Reimbursement.countDocuments({ status: 'changes_requested' }),
    ]);

    return {
        pending: { amount: pending[0]?.total || 0, count: pending[0]?.count || 0 },
        approved: { amount: approved[0]?.total || 0, count: approved[0]?.count || 0 },
        paidThisMonth: { amount: paidThisMonth[0]?.total || 0, count: paidThisMonth[0]?.count || 0 },
        changesRequested: { count: changesRequested },
    };
}

// ── Get single reimbursement ──────────────────────────────────────────
export async function getReimbursementById(userId: string, reimbursementId: string, isAdmin = false) {
    const reimbursement = await Reimbursement.findById(reimbursementId)
        .populate({
            path: 'employeeId',
            select: 'employeeId department designation userId',
            populate: { path: 'userId', select: 'name email' },
        })
        .lean();

    if (!reimbursement) throw new AppError('Reimbursement not found', 404);

    if (!isAdmin) {
        const employee = await Employee.findOne({ userId });
        // After populate, employeeId is the populated Employee doc — get its _id
        const employeeDocId = (reimbursement.employeeId as any)?._id?.toString()
            ?? reimbursement.employeeId?.toString();
        if (!employee || employeeDocId !== employee._id.toString()) {
            throw new AppError('Not authorized to view this claim', 403);
        }
    }

    // Shape populated employeeId so client receives { user: {...}, employee: {...} }
    const emp = reimbursement.employeeId as any;
    const shaped = {
        ...reimbursement,
        user: emp?.userId ?? null,
        employee: emp ? { _id: emp._id, employeeId: emp.employeeId, department: emp.department, designation: emp.designation } : null,
        employeeId: emp?._id ?? reimbursement.employeeId,
    };

    return shaped;
}

// ── Delete draft ──────────────────────────────────────────────────────
export async function deleteReimbursement(userId: string, reimbursementId: string, isAdmin = false) {
    const reimbursement = await Reimbursement.findById(reimbursementId);
    if (!reimbursement) throw new AppError('Reimbursement not found', 404);

    if (!isAdmin) {
        const employee = await Employee.findOne({ userId });
        if (!employee || reimbursement.employeeId.toString() !== employee._id.toString()) {
            throw new AppError('Not authorized to delete this claim', 403);
        }
        if (!['draft', 'changes_requested', 'pending'].includes(reimbursement.status)) {
            throw new AppError('Only draft, pending, or changes_requested claims can be deleted', 400);
        }
    }

    // Delete receipt from cloud storage
    if (reimbursement.receipt?.cloudinaryId) {
        await deleteDocument(reimbursement.receipt.cloudinaryId).catch(() => { /* best-effort */ });
    }

    await Reimbursement.deleteOne({ _id: reimbursementId });
}
