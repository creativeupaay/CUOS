import { Leave, ILeave } from '../models/Leave.model';
import { LeaveBalance } from '../models/LeaveBalance.model';
import { CreateLeaveInput, UpdateLeaveStatusInput } from '../validators/leave.validator';
import { Employee } from '../models/Employee.model';
import AppError from '../../../utils/appError';

class LeaveService {
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

        const leave = await Leave.create({
            ...data,
            employeeId: employee._id,
            startDate: startDateUtc,
            endDate: endDateUtc,
            days,
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

        if (leave.status !== 'pending') {
            throw new AppError(`Cannot ${data.status} a leave that is already ${leave.status}`, 400);
        }

        leave.status = data.status;
        if (data.status === 'approved' || data.status === 'rejected') {
            leave.approvedBy = approvedBy as any;
        }
        if (data.rejectionReason) {
            leave.rejectionReason = data.rejectionReason;
        }

        await leave.save();

        // Auto-update LeaveBalance if approved
        if (data.status === 'approved' && leave.type !== 'unpaid') {
            const year = leave.startDate.getFullYear();
            await this.ensureLeaveBalance(leave.employeeId.toString(), year);

            await LeaveBalance.updateOne(
                { employeeId: leave.employeeId, year, 'balances.type': leave.type },
                {
                    $inc: {
                        'balances.$.used': leave.days,
                        'balances.$.pending': -leave.days
                    }
                }
            );
        }

        return leave;
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
            ];
            balance = await LeaveBalance.create({
                employeeId,
                year,
                balances: defaultBalances
            });
        }
        return balance;
    }

    async getLeaveBalance(userId: string, year: number) {
        const employee = await Employee.findOne({ userId });
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

        return balance.balances;
    }
}

export const leaveService = new LeaveService();
