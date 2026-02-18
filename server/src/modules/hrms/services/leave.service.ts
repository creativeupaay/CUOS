import { Leave, ILeave } from '../models/Leave.model';
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
        return leave;
    }

    async getLeaveBalance(userId: string, year: number) {
        const employee = await Employee.findOne({ userId });
        if (!employee) {
            throw new AppError('Employee record not found', 404);
        }

        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);

        const leavesTaken = await Leave.aggregate([
            {
                $match: {
                    employeeId: employee._id,
                    status: 'approved',
                    startDate: { $gte: startOfYear, $lte: endOfYear },
                },
            },
            {
                $group: {
                    _id: '$type',
                    totalDays: { $sum: '$days' },
                    count: { $sum: 1 },
                },
            },
        ]);

        // Default leave allocation per year
        const allocation: Record<string, number> = {
            casual: 12,
            sick: 12,
            earned: 15,
            unpaid: 365, // unlimited
            maternity: 180,
            paternity: 15,
        };

        const balance = Object.entries(allocation).map(([type, total]) => {
            const taken = leavesTaken.find((l) => l._id === type);
            return {
                type,
                total,
                used: taken?.totalDays || 0,
                remaining: total - (taken?.totalDays || 0),
                count: taken?.count || 0,
            };
        });

        return balance;
    }
}

export const leaveService = new LeaveService();
