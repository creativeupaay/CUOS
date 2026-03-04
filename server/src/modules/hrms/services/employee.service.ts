import { Types } from 'mongoose';
import { Employee, IEmployee } from '../models/Employee.model';
import { CreateEmployeeInput, UpdateEmployeeInput } from '../validators/employee.validator';
import AppError from '../../../utils/appError';

class EmployeeService {
    async createEmployee(data: CreateEmployeeInput, createdBy: string): Promise<IEmployee> {
        // Check if user already has an employee record
        const existing = await Employee.findOne({ userId: data.userId });
        if (existing) {
            throw new AppError('Employee record already exists for this user', 400);
        }

        // Check if employeeId is unique
        const existingEmpId = await Employee.findOne({ employeeId: data.employeeId });
        if (existingEmpId) {
            throw new AppError('Employee ID already exists', 400);
        }

        const employee = await Employee.create({
            ...data,
            createdBy,
        });

        return employee;
    }

    async getEmployees(filters: {
        department?: string;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { department, status, search, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        // Build pre-lookup match (fast indexed fields)
        const preMatch: any = {};
        if (department) preMatch.department = department;
        if (status) preMatch.status = status;

        // Aggregation pipeline so we can search on joined user.name / user.email
        const pipeline: any[] = [
            { $match: preMatch },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: '_user',
                },
            },
            { $unwind: { path: '$_user', preserveNullAndEmptyArrays: true } },
        ];

        // Post-lookup search filter across name, email, employeeId, designation
        if (search && search.trim()) {
            const regex = { $regex: search.trim(), $options: 'i' };
            pipeline.push({
                $match: {
                    $or: [
                        { '_user.name': regex },
                        { '_user.email': regex },
                        { employeeId: regex },
                        { designation: regex },
                        { department: regex },
                    ],
                },
            });
        }

        // Count before pagination
        const countPipeline = [...pipeline, { $count: 'total' }];

        // Add sort + pagination
        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            // Re-shape: move _user back into userId so the frontend interface stays the same
            {
                $addFields: {
                    userId: {
                        _id: '$_user._id',
                        name: '$_user.name',
                        email: '$_user.email',
                    },
                },
            },
            { $unset: '_user' },
        );

        const [employees, countResult] = await Promise.all([
            Employee.aggregate(pipeline),
            Employee.aggregate(countPipeline),
        ]);

        const total = countResult[0]?.total ?? 0;

        return {
            employees,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async getEmployeeById(id: string): Promise<IEmployee> {
        const employee = await Employee.findById(id)
            .populate('userId', 'name email')
            .populate('reportingTo', 'employeeId designation');

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        return employee;
    }

    async getEmployeeByUserId(userId: string): Promise<IEmployee | null> {
        return Employee.findOne({ userId })
            .populate('userId', 'name email')
            .populate('reportingTo', 'employeeId designation');
    }

    async updateEmployee(id: string, data: UpdateEmployeeInput): Promise<IEmployee> {
        const employee = await Employee.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        })
            .populate('userId', 'name email')
            .populate('reportingTo', 'employeeId designation');

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        return employee;
    }

    async deleteEmployee(id: string): Promise<void> {
        const employee = await Employee.findByIdAndDelete(id);
        if (!employee) {
            throw new AppError('Employee not found', 404);
        }
    }

    async getTeamMembers(managerId: string) {
        return Employee.find({ reportingTo: managerId })
            .populate('userId', 'name email')
            .sort({ employeeId: 1 });
    }

    async getOnboardingEmployees() {
        return Employee.find({
            'onboarding.status': { $in: ['not-started', 'in-progress'] },
        })
            .populate('userId', 'name email')
            .sort({ joiningDate: -1 });
    }

    async updateOnboardingChecklist(
        employeeId: string,
        checklist: { item: string; completed: boolean }[]
    ): Promise<IEmployee> {
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        employee.onboarding.checklist = checklist.map((c) => ({
            ...c,
            completedAt: c.completed ? new Date() : undefined,
        })) as any;

        // Auto-update onboarding status
        const allDone = checklist.every((c) => c.completed);
        const anyDone = checklist.some((c) => c.completed);

        if (allDone && checklist.length > 0) {
            employee.onboarding.status = 'completed';
            employee.onboarding.completedAt = new Date();
        } else if (anyDone) {
            employee.onboarding.status = 'in-progress';
            if (!employee.onboarding.startedAt) {
                employee.onboarding.startedAt = new Date();
            }
        }

        await employee.save();
        return employee;
    }
}

export const employeeService = new EmployeeService();
