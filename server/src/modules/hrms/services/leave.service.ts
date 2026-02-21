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

        // Check for overlapping leaves
        const overlapping = await Leave.findOne({
            employeeId: employee._id,
            status: { $in: ['pending', 'approved'] },
            $or: [
                {
                    startDate: { $lte: new Date(data.endDate) },
                    endDate: { $gte: new Date(data.startDate) },
                },
            ],
        });

        if (overlapping) {
            throw new AppError('Leave dates overlap with an existing leave request', 400);
        }

        const leave = await Leave.create({
            ...data,
            employeeId: employee._id,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
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
            const defaultBalances = [
                { type: 'casual', quota: 12, used: 0, pending: 12 },
                { type: 'sick', quota: 12, used: 0, pending: 12 },
                { type: 'earned', quota: 15, used: 0, pending: 15 },
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

        const balance = await this.ensureLeaveBalance(employee._id.toString(), year);
        return balance.balances;
    }
}

export const leaveService = new LeaveService();
