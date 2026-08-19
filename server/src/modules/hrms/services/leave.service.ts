import { Leave, ILeave } from '../models/Leave.model';
import { LeaveBalance } from '../models/LeaveBalance.model';
import { Types } from 'mongoose';
import { CreateLeaveInput, UpdateLeaveStatusInput } from '../validators/leave.validator';
import { Employee } from '../models/Employee.model';
import { Attendance } from '../models/Attendance.model';
import AppError from '../../../utils/appError';
import { notificationService } from '../../notification/services/notification.service';
import { notifyTeamOfApprovedLeave } from './leaveNotification.service';
import { getDepartmentCatalog, resolveDepartmentValue } from '../../../utils/department.util';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';
import { createArchiveSnapshot } from '../../archive/utils/archiveSnapshot.util';
import { logger } from '../../../utils/logger';

class LeaveService {
    private shouldConsumePaidLeave(leave: ILeave): boolean {
        return leave.type !== 'unpaid' && leave.type !== 'wfh' && leave.isPaid;
    }

    private shouldConsumePaidLeaveByValues(type: ILeave['type'], isPaid: boolean): boolean {
        return type !== 'unpaid' && type !== 'wfh' && isPaid;
    }

    async createLeave(data: CreateLeaveInput, userId: string): Promise<ILeave> {
        // Find the employee by userId
        const employee = await Employee.findOne({ userId });
        if (!employee) {
            throw new AppError('Employee record not found', 404);
        }

        // Parse dates as UTC midnight to avoid server IST timezone shift
        const [sy, sm, sd] = data.startDate.split('-').map(Number);
        const [ey, em, ed] = data.endDate.split('-').map(Number);
        const startDateUtc = new Date(Date.UTC(sy, sm - 1, sd));
        const endDateUtc = new Date(Date.UTC(ey, em - 1, ed));

        // days: use the value sent by the client, or calculate if missing
        const days = data.days ?? Math.round((endDateUtc.getTime() - startDateUtc.getTime()) / 86400000) + 1;

        // Check for overlapping leaves
        const overlapping = await Leave.findOne({
            employeeId: employee._id,
            status: { $in: ['pending', 'approved'] },
            $or: [
                {
                    startDate: { $lte: endDateUtc },
                    endDate: { $gte: startDateUtc },
                },
            ],
        });

        if (overlapping) {
            throw new AppError('Leave dates overlap with an existing leave request', 400);
        }

        const normalizedIsPaid = (data.type === 'unpaid' || data.type === 'wfh') ? false : data.isPaid;

        const leave = await Leave.create({
            ...data,
            isPaid: normalizedIsPaid,
            employeeId: employee._id,
            startDate: startDateUtc,
            endDate: endDateUtc,
            days,
        });

        // Notify superadmins about new leave request
        const populatedEmployee = await Employee.findById(employee._id)
            .populate('userId', 'name')
            .lean();
        const employeeName = (populatedEmployee?.userId as any)?.name || 'An employee';

        notificationService.notifySuperadmins({
            type: 'leave_submitted',
            title: 'New Leave Application',
            message: `${employeeName} has applied for ${days} day(s) of ${data.type} leave.`,
            link: '/hrms/leaves?status=pending',
            metadata: {
                leaveId: leave._id.toString(),
                employeeId: employee._id.toString(),
                leaveType: data.type,
                days,
            },
        });

        return leave;
    }

    async getLeaves(filters: {
        employeeId?: string;
        status?: string;
        type?: string;
        page?: number;
        limit?: number;
    }) {
        const { employeeId, status, type, page = 1, limit = 20 } = filters;
        const query: any = {};

        if (employeeId) query.employeeId = employeeId;
        if (status) query.status = status;
        if (type) query.type = type;

        const skip = (page - 1) * limit;
        const [leaves, total] = await Promise.all([
            Leave.find(query)
                .populate({
                    path: 'employeeId',
                    populate: { path: 'userId', select: 'name email' },
                })
                .populate('approvedBy', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Leave.countDocuments(query),
        ]);
        const departmentCatalog = await getDepartmentCatalog();
        leaves.forEach((leave) => {
            const employee = leave.employeeId as any;
            if (employee?.department) {
                employee.department = resolveDepartmentValue(employee.department, departmentCatalog);
            }
        });

        return {
            leaves,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    async getLeaveById(id: string): Promise<ILeave> {
        const leave = await Leave.findById(id)
            .populate({
                path: 'employeeId',
                populate: { path: 'userId', select: 'name email' },
            })
            .populate('approvedBy', 'name');

        if (!leave) {
            throw new AppError('Leave not found', 404);
        }
        const departmentCatalog = await getDepartmentCatalog();
        const employee = leave.employeeId as any;
        if (employee?.department) {
            employee.department = resolveDepartmentValue(employee.department, departmentCatalog);
        }

        return leave;
    }

    async getMyLeaves(userId: string, filters: { status?: string; page?: number; limit?: number }) {
        const employee = await Employee.findOne({ userId });
        if (!employee) {
            throw new AppError('Employee record not found', 404);
        }

        return this.getLeaves({ ...filters, employeeId: employee._id.toString() });
    }

    async updateLeaveStatus(
        id: string,
        data: UpdateLeaveStatusInput,
        approvedBy: string
    ): Promise<ILeave> {
        const leave = await Leave.findById(id);
        if (!leave) {
            throw new AppError('Leave not found', 404);
        }

        const previousStatus = leave.status;
        const nextStatus = data.status;
        const previousType = leave.type;
        const previousIsPaid = leave.isPaid;

        const nextType = data.type ?? previousType;
        const requestedIsPaid = data.isPaid ?? previousIsPaid;
        const nextIsPaid = (nextType === 'unpaid' || nextType === 'wfh') ? false : requestedIsPaid;

        const previousConsumesPaidBalance = this.shouldConsumePaidLeaveByValues(previousType, previousIsPaid);
        const nextConsumesPaidBalance = this.shouldConsumePaidLeaveByValues(nextType, nextIsPaid);

        leave.type = nextType;
        leave.isPaid = nextIsPaid;

        if (previousStatus === nextStatus) {
            if (previousStatus === 'approved' && nextStatus === 'approved' && previousConsumesPaidBalance !== nextConsumesPaidBalance) {
                const year = leave.startDate.getUTCFullYear();
                if (previousConsumesPaidBalance && !nextConsumesPaidBalance) {
                    await this.restorePaidLeaveBalance(leave.employeeId.toString(), year, leave.days);
                } else if (!previousConsumesPaidBalance && nextConsumesPaidBalance) {
                    await this.ensureLeaveBalance(leave.employeeId.toString(), year);
                    await this.consumePaidLeaveBalance(leave.employeeId.toString(), year, leave.days);
                }
            }

            if (nextStatus === 'rejected') {
                leave.rejectionReason = data.rejectionReason;
                leave.approvedBy = approvedBy as any;
                await leave.save();
            } else {
                await leave.save();
            }

            return leave;
        }

        if (previousStatus === 'approved' && nextStatus !== 'approved') {
            const year = leave.startDate.getUTCFullYear();
            if (previousConsumesPaidBalance) {
                await this.restorePaidLeaveBalance(leave.employeeId.toString(), year, leave.days);
            }
            await this.rollbackApprovedLeaveAttendance(leave, {
                deletedBy: approvedBy,
                reason: 'Leave status update removed approved leave attendance',
                metadata: {
                    leaveId: leave._id.toString(),
                    employeeId: leave.employeeId.toString(),
                    previousStatus,
                    nextStatus,
                },
            });
        }

        leave.status = nextStatus;
        if (nextStatus === 'approved' || nextStatus === 'rejected') {
            leave.approvedBy = approvedBy as any;
        } else {
            leave.approvedBy = undefined;
        }

        if (nextStatus === 'rejected' && data.rejectionReason) {
            leave.rejectionReason = data.rejectionReason;
        } else if (nextStatus !== 'rejected') {
            leave.rejectionReason = undefined;
        }

        if (nextStatus === 'approved') {
            const year = leave.startDate.getUTCFullYear();
            await this.ensureLeaveBalance(leave.employeeId.toString(), year);

            if (nextConsumesPaidBalance) {
                await this.consumePaidLeaveBalance(leave.employeeId.toString(), year, leave.days);
            }
        }

        await leave.save();

        if (nextStatus === 'approved') {
            await this.applyApprovedLeaveAttendance(leave);
        }

        // Notify the employee about the status update
        const employee = await Employee.findById(leave.employeeId).select('userId').lean();
        const employeeName = (await Employee.findById(leave.employeeId).populate('userId', 'name').lean() as any)?.userId?.name || 'Team member';

        if (employee?.userId) {
            const statusText = nextStatus;
            const statusCapitalized = statusText.charAt(0).toUpperCase() + statusText.slice(1);

            notificationService.createNotification({
                userId: employee.userId.toString(),
                type: 'leave_status_updated',
                title: `Leave ${statusCapitalized}`,
                message:
                    nextStatus === 'approved'
                        ? `Your ${leave.type} leave request for ${leave.days} day(s) has been approved.`
                        : nextStatus === 'rejected'
                            ? `Your ${leave.type} leave request has been rejected.${data.rejectionReason ? ' Reason: ' + data.rejectionReason : ''}`
                            : `Your ${leave.type} leave request has been marked as cancelled.`,
                link: '/my-hrms/leaves',
                metadata: {
                    leaveId: leave._id.toString(),
                    previousStatus,
                    status: nextStatus,
                    rejectionReason: data.rejectionReason,
                },
            });
        }

        // Broadcast team notification when leave is approved
        // Fire-and-forget — don't let notification failure block the response
        if (nextStatus === 'approved') {
            notifyTeamOfApprovedLeave(leave, employeeName).catch((err) =>
                logger.warn({ err, leaveId: leave._id }, '[Leave] Failed to send team notification')
            );
        }

        return leave;
    }

    async deleteLeave(id: string, options: ArchiveDeleteOptions = {}): Promise<void> {
        const leave = await Leave.findById(id);
        if (!leave) {
            throw new AppError('Leave not found', 404);
        }

        const archiveBatchId = options.archiveBatchId ?? DeletedRecordService.generateArchiveBatchId();
        const year = leave.startDate.getUTCFullYear();
        const balanceBefore = await LeaveBalance.findOne({ employeeId: leave.employeeId, year });
        const leaveAttendance = await this.getApprovedLeaveAttendance(leave);

        const archivedLeave = await DeletedRecordService.archiveDocument(leave, {
            archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Leave delete requested',
            operation: 'delete',
            session: options.session,
            metadata: {
                ...options.metadata,
                leaveId: leave._id.toString(),
                employeeId: leave.employeeId.toString(),
                status: leave.status,
                year,
                leaveBalanceBefore: balanceBefore ? createArchiveSnapshot(balanceBefore) : null,
                attendanceIds: leaveAttendance.map((attendance) => attendance._id.toString()),
            },
        });

        await DeletedRecordService.archiveDocuments(leaveAttendance, {
            archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Leave delete requested',
            operation: 'cascade_delete',
            session: options.session,
            metadata: {
                ...options.metadata,
                leaveId: leave._id.toString(),
                employeeId: leave.employeeId.toString(),
                linkedFrom: 'Leave',
            },
        });

        if (leave.status === 'approved') {
            if (this.shouldConsumePaidLeave(leave)) {
                await this.restorePaidLeaveBalance(leave.employeeId.toString(), year, leave.days);
            }
            await this.rollbackApprovedLeaveAttendance(leave, {
                ...options,
                archiveBatchId,
                skipArchive: true,
            });
        }

        const balanceAfter = await LeaveBalance.findOne({ employeeId: leave.employeeId, year });
        archivedLeave.metadata = {
            ...(archivedLeave.metadata ?? {}),
            leaveBalanceAfter: balanceAfter ? createArchiveSnapshot(balanceAfter) : null,
        };
        archivedLeave.markModified('metadata');
        await archivedLeave.save({ session: options.session });

        await leave.deleteOne(options.session ? { session: options.session } : undefined);
    }

    private async consumePaidLeaveBalance(employeeId: string, year: number, leaveDays: number) {
        const balance = await this.ensureLeaveBalance(employeeId, year);
        const earned = balance.balances.find((b) => b.type === 'earned');

        if (!earned) {
            throw new AppError('Paid leave balance is not configured for this employee', 400);
        }

        const remainingPaidLeaves = Math.max(0, earned.quota - earned.used);
        if (remainingPaidLeaves < leaveDays) {
            throw new AppError(
                `Insufficient paid leave balance. Remaining ${remainingPaidLeaves} day(s), requested ${leaveDays} day(s)`,
                400
            );
        }

        earned.used += leaveDays;
        earned.pending = Math.max(0, earned.quota - earned.used);
        await balance.save();
    }

    private async restorePaidLeaveBalance(employeeId: string, year: number, leaveDays: number) {
        const balance = await this.ensureLeaveBalance(employeeId, year);
        const earned = balance.balances.find((b) => b.type === 'earned');

        if (!earned) {
            throw new AppError('Paid leave balance is not configured for this employee', 400);
        }

        earned.used = Math.max(0, earned.used - leaveDays);
        earned.pending = Math.max(0, earned.quota - earned.used);
        await balance.save();
    }

    private async applyApprovedLeaveAttendance(leave: ILeave) {
        const leaveDates: Date[] = [];
        const cursor = new Date(leave.startDate);
        cursor.setUTCHours(0, 0, 0, 0);

        const end = new Date(leave.endDate);
        end.setUTCHours(0, 0, 0, 0);

        while (cursor.getTime() <= end.getTime()) {
            leaveDates.push(new Date(cursor));
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        if (leaveDates.length === 0) {
            return;
        }

        const operations = leaveDates.map((date) => ({
            updateOne: {
                filter: {
                    employeeId: leave.employeeId,
                    date,
                },
                update: {
                    $set: {
                        status: 'on-leave',
                        source: 'leave',
                        totalHours: 0,
                        notes: 'Auto-marked on leave due to approved leave',
                    },
                    $unset: {
                        checkIn: '',
                        checkOut: '',
                        projectId: '',
                        taskId: '',
                    },
                },
                upsert: true,
            },
        }));

        await Attendance.bulkWrite(operations);
    }

    private async getApprovedLeaveAttendance(leave: ILeave) {
        const leaveDates: Date[] = [];
        const cursor = new Date(leave.startDate);
        cursor.setUTCHours(0, 0, 0, 0);

        const end = new Date(leave.endDate);
        end.setUTCHours(0, 0, 0, 0);

        while (cursor.getTime() <= end.getTime()) {
            leaveDates.push(new Date(cursor));
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        if (leaveDates.length === 0) {
            return [];
        }

        return Attendance.find({
            employeeId: leave.employeeId,
            date: { $in: leaveDates },
            status: 'on-leave',
            notes: 'Auto-marked on leave due to approved leave',
        });
    }

    private async rollbackApprovedLeaveAttendance(leave: ILeave, options: ArchiveDeleteOptions = {}) {
        const attendanceRecords = await this.getApprovedLeaveAttendance(leave);

        if (attendanceRecords.length === 0) {
            return;
        }

        if (!options.skipArchive) {
            await DeletedRecordService.archiveDocuments(attendanceRecords, {
                archiveBatchId: options.archiveBatchId,
                deletedBy: options.deletedBy,
                reason: options.reason ?? 'Approved leave attendance rollback',
                operation: 'cascade_delete',
                session: options.session,
                metadata: {
                    ...options.metadata,
                    leaveId: leave._id.toString(),
                    employeeId: leave.employeeId.toString(),
                    linkedFrom: 'Leave',
                },
            });
        }

        await Attendance.deleteMany(
            { _id: { $in: attendanceRecords.map((attendance) => attendance._id) } },
            options.session ? { session: options.session } : undefined
        );
    }

    private async ensureLeaveBalance(employeeId: string, year: number) {
        let balance = await LeaveBalance.findOne({ employeeId, year });
        if (!balance) {
            const employee = await Employee.findById(employeeId);
            const paidLeaves = employee?.paidLeavesPerYear ?? 12;

            const defaultBalances = [
                { type: 'casual', quota: 0, used: 0, pending: 0 },
                { type: 'sick', quota: 0, used: 0, pending: 0 },
                { type: 'earned', quota: paidLeaves, used: 0, pending: paidLeaves },
                { type: 'unpaid', quota: 365, used: 0, pending: 365 },
                { type: 'maternity', quota: 180, used: 0, pending: 180 },
                { type: 'paternity', quota: 15, used: 0, pending: 15 },
                { type: 'sabbatical', quota: 0, used: 0, pending: 0 },
                { type: 'menstrual', quota: 12, used: 0, pending: 12 },
                { type: 'wfh', quota: 0, used: 0, pending: 0 },
            ];
            balance = await LeaveBalance.create({
                employeeId,
                year,
                balances: defaultBalances
            });
        }
        return balance;
    }

    private async syncEarnedUsageFromApprovedLeaves(employeeId: Types.ObjectId | string, year: number) {
        const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
        const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

        const result = await Leave.aggregate<{ total: number }>([
            {
                $match: {
                    employeeId,
                    status: 'approved',
                    startDate: { $gte: startOfYear, $lte: endOfYear },
                    type: { $nin: ['unpaid', 'wfh'] },
                    $or: [{ isPaid: true }, { isPaid: { $exists: false } }, { isPaid: null }],
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$days' },
                },
            },
        ]);

        return result[0]?.total ?? 0;
    }

    private async getApprovedLeaveYearSummary(employeeId: Types.ObjectId | string, year: number) {
        const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
        const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

        const rows = await Leave.aggregate<{ _id: 'paid' | 'unpaid' | 'wfh'; requests: number; days: number }>([
            {
                $match: {
                    employeeId,
                    status: 'approved',
                    startDate: { $gte: startOfYear, $lte: endOfYear },
                },
            },
            {
                $project: {
                    days: '$days',
                    bucket: {
                        $cond: [
                            { $eq: ['$type', 'wfh'] },
                            'wfh',
                            {
                                $cond: [
                                    {
                                        $or: [{ $eq: ['$type', 'unpaid'] }, { $eq: ['$isPaid', false] }],
                                    },
                                    'unpaid',
                                    'paid',
                                ],
                            }
                        ]
                    },
                },
            },
            {
                $group: {
                    _id: '$bucket',
                    requests: { $sum: 1 },
                    days: { $sum: '$days' },
                },
            },
        ]);

        const paid = rows.find((r) => r._id === 'paid');
        const unpaid = rows.find((r) => r._id === 'unpaid');
        const wfh = rows.find((r) => r._id === 'wfh');

        return {
            paid: {
                requests: paid?.requests ?? 0,
                days: paid?.days ?? 0,
            },
            unpaid: {
                requests: unpaid?.requests ?? 0,
                days: unpaid?.days ?? 0,
            },
            wfh: {
                requests: wfh?.requests ?? 0,
                days: wfh?.days ?? 0,
            },
            totalApprovedRequests: (paid?.requests ?? 0) + (unpaid?.requests ?? 0),
            totalApprovedDays: (paid?.days ?? 0) + (unpaid?.days ?? 0),
        };
    }

    async getLeaveBalance(userId: string, year: number, employeeId?: string) {
        // Allow admin to query by employeeId directly
        const employee = employeeId
            ? await Employee.findById(employeeId)
            : await Employee.findOne({ userId });
        if (!employee) {
            throw new AppError('Employee record not found', 404);
        }

        let balance = await this.ensureLeaveBalance(employee._id.toString(), year);

        // ── Sync earned quota from employee's paidLeavesPerYear ────────
        // If the employee's paid leaves per year changed after the balance
        // was first created, we need to update the earned quota & pending.
        const paidLeavesPerYear = employee.paidLeavesPerYear ?? 12;
        const earnedEntry = balance.balances.find((b) => b.type === 'earned');
        if (earnedEntry && earnedEntry.quota !== paidLeavesPerYear) {
            const used = earnedEntry.used;
            const newPending = Math.max(0, paidLeavesPerYear - used);
            await LeaveBalance.updateOne(
                { _id: balance._id, 'balances.type': 'earned' },
                {
                    $set: {
                        'balances.$.quota': paidLeavesPerYear,
                        'balances.$.pending': newPending,
                    },
                }
            );
            // Reload the updated document
            balance = (await LeaveBalance.findById(balance._id))!;
        }

        // Reconcile from leave history to include legacy approved paid leaves
        // that were created before balance tracking was introduced.
        const reconciledUsed = await this.syncEarnedUsageFromApprovedLeaves(employee._id, year);
        const refreshedEarned = balance.balances.find((b) => b.type === 'earned');
        if (refreshedEarned && refreshedEarned.used !== reconciledUsed) {
            const newPending = Math.max(0, refreshedEarned.quota - reconciledUsed);
            await LeaveBalance.updateOne(
                { _id: balance._id, 'balances.type': 'earned' },
                {
                    $set: {
                        'balances.$.used': reconciledUsed,
                        'balances.$.pending': newPending,
                    },
                }
            );
            balance = (await LeaveBalance.findById(balance._id))!;
        }

        const leaveSummary = await this.getApprovedLeaveYearSummary(employee._id, year);

        return {
            balance: balance.balances,
            leaveSummary,
        };
    }
}

export const leaveService = new LeaveService();
