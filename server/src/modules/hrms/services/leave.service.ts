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

        // days: use the value sent by the client, or calculate excluding Sundays if missing
        let calculatedDays = 0;
        const cur = new Date(startDateUtc);
        while (cur.getTime() <= endDateUtc.getTime()) {
            if (cur.getUTCDay() !== 0) {
                calculatedDays++;
            }
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
        const days = data.days ?? Math.max(1, calculatedDays);

        // Check for overlapping leaves
        const overlapping = await Leave.find({
            employeeId: employee._id,
            status: { $in: ['pending', 'approved'] },
            startDate: { $lte: endDateUtc },
            endDate: { $gte: startDateUtc },
        });

        if (overlapping.length > 0) {
            // Check if there is an exact duplicate request with the same leave type
            const isExactDuplicate = overlapping.some(
                (l) => l.type === data.type &&
                    l.startDate.getTime() === startDateUtc.getTime() &&
                    l.endDate.getTime() === endDateUtc.getTime()
            );
            if (isExactDuplicate) {
                throw new AppError(`You already have a leave request for these dates with the same leave type (${data.type}).`, 400);
            }

            // Adjust or carve out dates from each overlapping leave to allow the new leave type
            for (const oldLeave of overlapping) {
                await this.adjustOrCancelOverlappingLeave(oldLeave, startDateUtc, endDateUtc, data.type, userId);
            }
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

        // Notify superadmins about new leave request or change request
        const isChangeRequest = overlapping.length > 0;
        const populatedEmployee = await Employee.findById(employee._id)
            .populate('userId', 'name')
            .lean();
        const employeeName = (populatedEmployee?.userId as any)?.name || 'An employee';

        notificationService.notifySuperadmins({
            type: 'leave_submitted',
            title: isChangeRequest ? 'Leave Change Request' : 'New Leave Application',
            message: isChangeRequest
                ? `${employeeName} has requested to change leave to ${days} day(s) of ${data.type} leave (${data.startDate}${data.startDate !== data.endDate ? ' to ' + data.endDate : ''}).`
                : `${employeeName} has applied for ${days} day(s) of ${data.type} leave.`,
            link: '/hrms/leaves?status=pending',
            metadata: {
                leaveId: leave._id.toString(),
                employeeId: employee._id.toString(),
                leaveType: data.type,
                days,
                isChangeRequest,
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

            if (previousStatus === 'approved' && previousType !== nextType) {
                await this.applyApprovedLeaveAttendance(leave);
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
            // Never mark attendance on Sunday (weekly off)
            if (cursor.getUTCDay() !== 0) {
                leaveDates.push(new Date(cursor));
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        if (leaveDates.length === 0) {
            return;
        }

        const isWfh = leave.type === 'wfh';
        const attendanceStatus = isWfh ? 'wfh' : 'on-leave';
        const attendanceNotes = isWfh ? 'Approved Work From Home' : 'Auto-marked on leave due to approved leave';

        const operations = leaveDates.map((date) => ({
            updateOne: {
                filter: {
                    employeeId: leave.employeeId,
                    date,
                },
                update: {
                    $set: {
                        status: attendanceStatus,
                        source: 'leave',
                        totalHours: 0,
                        notes: attendanceNotes,
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
            if (cursor.getUTCDay() !== 0) {
                leaveDates.push(new Date(cursor));
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        if (leaveDates.length === 0) {
            return [];
        }

        return Attendance.find({
            employeeId: leave.employeeId,
            date: { $in: leaveDates },
            $or: [
                { status: { $in: ['on-leave', 'wfh'] } },
                { source: 'leave' },
            ],
        });
    }

    private countWorkingDaysExcludingSundays(start: Date, end: Date): number {
        let count = 0;
        const cur = new Date(start);
        cur.setUTCHours(0, 0, 0, 0);
        const endT = new Date(end);
        endT.setUTCHours(0, 0, 0, 0);
        while (cur.getTime() <= endT.getTime()) {
            if (cur.getUTCDay() !== 0) {
                count++;
            }
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
        return count;
    }

    private getOverlapDates(start1: Date, end1: Date, start2: Date, end2: Date): Date[] {
        const dates: Date[] = [];
        const cur = new Date(Math.max(start1.getTime(), start2.getTime()));
        cur.setUTCHours(0, 0, 0, 0);
        const end = new Date(Math.min(end1.getTime(), end2.getTime()));
        end.setUTCHours(0, 0, 0, 0);
        while (cur.getTime() <= end.getTime()) {
            if (cur.getUTCDay() !== 0) {
                dates.push(new Date(cur));
            }
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
        return dates;
    }

    private async adjustOrCancelOverlappingLeave(
        oldLeave: ILeave,
        newStart: Date,
        newEnd: Date,
        newType: string,
        userId: string
    ) {
        const oldStart = new Date(oldLeave.startDate);
        const oldEnd = new Date(oldLeave.endDate);
        oldStart.setUTCHours(0, 0, 0, 0);
        oldEnd.setUTCHours(0, 0, 0, 0);

        const overlapDates = this.getOverlapDates(oldStart, oldEnd, newStart, newEnd);

        // If the old leave was approved, rollback attendance on overlapping dates and restore consumed balance
        if (oldLeave.status === 'approved' && overlapDates.length > 0) {
            await Attendance.deleteMany({
                employeeId: oldLeave.employeeId,
                date: { $in: overlapDates },
            });

            if (this.shouldConsumePaidLeaveByValues(oldLeave.type, oldLeave.isPaid)) {
                const year = oldStart.getUTCFullYear();
                await this.restorePaidLeaveBalance(oldLeave.employeeId.toString(), year, overlapDates.length);
            }
        }

        const newStartTime = newStart.getTime();
        const newEndTime = newEnd.getTime();
        const oldStartTime = oldStart.getTime();
        const oldEndTime = oldEnd.getTime();

        // Case 1: New request completely covers oldLeave
        if (newStartTime <= oldStartTime && newEndTime >= oldEndTime) {
            oldLeave.status = 'cancelled';
            oldLeave.rejectionReason = `Superseded by ${newType} leave change request`;
            await oldLeave.save();
            return;
        }

        // Case 2: New request covers the end of oldLeave (newStart > oldStart && newEnd >= oldEnd)
        if (newStartTime > oldStartTime && newEndTime >= oldEndTime) {
            const truncatedEnd = new Date(newStart);
            truncatedEnd.setUTCDate(truncatedEnd.getUTCDate() - 1);
            const remainingDays = this.countWorkingDaysExcludingSundays(oldStart, truncatedEnd);
            if (remainingDays <= 0) {
                oldLeave.status = 'cancelled';
                oldLeave.rejectionReason = `Superseded by ${newType} leave change request`;
            } else {
                oldLeave.endDate = truncatedEnd;
                oldLeave.days = remainingDays;
            }
            await oldLeave.save();
            return;
        }

        // Case 3: New request covers the start of oldLeave (newStart <= oldStart && newEnd < oldEnd)
        if (newStartTime <= oldStartTime && newEndTime < oldEndTime) {
            const truncatedStart = new Date(newEnd);
            truncatedStart.setUTCDate(truncatedStart.getUTCDate() + 1);
            const remainingDays = this.countWorkingDaysExcludingSundays(truncatedStart, oldEnd);
            if (remainingDays <= 0) {
                oldLeave.status = 'cancelled';
                oldLeave.rejectionReason = `Superseded by ${newType} leave change request`;
            } else {
                oldLeave.startDate = truncatedStart;
                oldLeave.days = remainingDays;
            }
            await oldLeave.save();
            return;
        }

        // Case 4: New request is in the middle of oldLeave (newStart > oldStart && newEnd < oldEnd)
        if (newStartTime > oldStartTime && newEndTime < oldEndTime) {
            const seg1End = new Date(newStart);
            seg1End.setUTCDate(seg1End.getUTCDate() - 1);
            const seg1Days = this.countWorkingDaysExcludingSundays(oldStart, seg1End);

            const seg2Start = new Date(newEnd);
            seg2Start.setUTCDate(seg2Start.getUTCDate() + 1);
            const seg2Days = this.countWorkingDaysExcludingSundays(seg2Start, oldEnd);

            oldLeave.endDate = seg1End;
            oldLeave.days = Math.max(1, seg1Days);
            await oldLeave.save();

            if (seg2Days > 0) {
                await Leave.create({
                    employeeId: oldLeave.employeeId,
                    type: oldLeave.type,
                    startDate: seg2Start,
                    endDate: oldEnd,
                    days: seg2Days,
                    reason: oldLeave.reason,
                    status: oldLeave.status,
                    isPaid: oldLeave.isPaid,
                    approvedBy: oldLeave.approvedBy,
                });
            }
        }
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
