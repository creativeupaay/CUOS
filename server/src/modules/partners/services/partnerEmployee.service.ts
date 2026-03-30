import { Types } from 'mongoose';
import { PartnerEmployee, IPartnerEmployee } from '../models/PartnerEmployee.model';
import { Partner } from '../models/Partner.model';
import AppError from '../../../utils/appError';

export interface CreatePartnerEmployeeInput {
    name: string;
    email: string;
    password: string;
    phone?: string;
    designation?: string;
    modulePermissions?: {
        projectManagement?: boolean;
        crm?: boolean;
        teamManagement?: boolean;
    };
}

export interface UpdatePartnerEmployeeInput {
    name?: string;
    email?: string;
    phone?: string;
    designation?: string;
    isActive?: boolean;
    modulePermissions?: {
        projectManagement?: boolean;
        crm?: boolean;
        teamManagement?: boolean;
    };
}

export interface ListPartnerEmployeesFilters {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export class PartnerEmployeeService {
    /**
     * Get partner ID from user (either Partner user or PartnerEmployee)
     */
    private async getPartnerIdFromUser(userId: string): Promise<string> {
        // First check if it's a partner
        const partner = await Partner.findOne({ userId });
        if (partner) {
            return partner._id.toString();
        }

        // Check if it's a partner employee
        const partnerEmployee = await PartnerEmployee.findById(userId);
        if (partnerEmployee) {
            return partnerEmployee.partnerId.toString();
        }

        throw new AppError('Partner not found', 404);
    }

    /**
     * Create a new partner employee
     */
    async createEmployee(
        data: CreatePartnerEmployeeInput,
        createdByUserId: string
    ): Promise<IPartnerEmployee> {
        const partnerId = await this.getPartnerIdFromUser(createdByUserId);

        // Check if email already exists
        const existingEmployee = await PartnerEmployee.findOne({ email: data.email });
        if (existingEmployee) {
            throw new AppError('An employee with this email already exists', 400);
        }

        const employee = await PartnerEmployee.create({
            ...data,
            partnerId: new Types.ObjectId(partnerId),
            createdBy: new Types.ObjectId(createdByUserId),
        });

        return employee;
    }

    /**
     * Get all employees for a partner
     */
    async getEmployees(
        userId: string,
        filters: ListPartnerEmployeesFilters
    ): Promise<{
        employees: IPartnerEmployee[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const partnerId = await this.getPartnerIdFromUser(userId);
        const { search, isActive, page = 1, limit = 20 } = filters;

        const query: any = { partnerId: new Types.ObjectId(partnerId) };

        if (isActive !== undefined) {
            query.isActive = isActive;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { designation: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [employees, total] = await Promise.all([
            PartnerEmployee.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-password')
                .lean(),
            PartnerEmployee.countDocuments(query),
        ]);

        return {
            employees: employees as IPartnerEmployee[],
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get employee by ID
     */
    async getEmployeeById(
        employeeId: string,
        userId: string
    ): Promise<IPartnerEmployee> {
        const partnerId = await this.getPartnerIdFromUser(userId);

        const employee = await PartnerEmployee.findOne({
            _id: employeeId,
            partnerId: new Types.ObjectId(partnerId),
        }).select('-password');

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        return employee;
    }

    /**
     * Update employee
     */
    async updateEmployee(
        employeeId: string,
        data: UpdatePartnerEmployeeInput,
        userId: string
    ): Promise<IPartnerEmployee> {
        const partnerId = await this.getPartnerIdFromUser(userId);

        // Check if new email already exists
        if (data.email) {
            const existingEmployee = await PartnerEmployee.findOne({
                email: data.email,
                _id: { $ne: employeeId },
            });
            if (existingEmployee) {
                throw new AppError('An employee with this email already exists', 400);
            }
        }

        const employee = await PartnerEmployee.findOneAndUpdate(
            {
                _id: employeeId,
                partnerId: new Types.ObjectId(partnerId),
            },
            { $set: data },
            { new: true, runValidators: true }
        ).select('-password');

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        return employee;
    }

    /**
     * Delete employee
     */
    async deleteEmployee(employeeId: string, userId: string): Promise<void> {
        const partnerId = await this.getPartnerIdFromUser(userId);

        const employee = await PartnerEmployee.findOneAndDelete({
            _id: employeeId,
            partnerId: new Types.ObjectId(partnerId),
        });

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }
    }

    /**
     * Toggle employee active status
     */
    async toggleEmployeeStatus(
        employeeId: string,
        userId: string
    ): Promise<IPartnerEmployee> {
        const partnerId = await this.getPartnerIdFromUser(userId);

        const employee = await PartnerEmployee.findOne({
            _id: employeeId,
            partnerId: new Types.ObjectId(partnerId),
        });

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        employee.isActive = !employee.isActive;
        await employee.save();

        const updatedEmployee = await PartnerEmployee.findById(employeeId).select('-password');
        return updatedEmployee as IPartnerEmployee;
    }

    /**
     * Reset employee password
     */
    async resetEmployeePassword(
        employeeId: string,
        newPassword: string,
        userId: string
    ): Promise<void> {
        const partnerId = await this.getPartnerIdFromUser(userId);

        const employee = await PartnerEmployee.findOne({
            _id: employeeId,
            partnerId: new Types.ObjectId(partnerId),
        }).select('+password');

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        employee.password = newPassword;
        await employee.save();
    }

    /**
     * Get employee stats for a partner
     */
    async getStats(userId: string): Promise<{
        total: number;
        active: number;
        inactive: number;
    }> {
        const partnerId = await this.getPartnerIdFromUser(userId);

        const [total, active] = await Promise.all([
            PartnerEmployee.countDocuments({ partnerId: new Types.ObjectId(partnerId) }),
            PartnerEmployee.countDocuments({
                partnerId: new Types.ObjectId(partnerId),
                isActive: true,
            }),
        ]);

        return {
            total,
            active,
            inactive: total - active,
        };
    }
}
