import { User, IUser } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import AppError from '../../../utils/appError';
import { AuditLog } from '../models/AuditLog.model';
import { Employee } from '../../hrms/models/Employee.model';
import { Job } from '../../hiring/models/Job.model';
import { Partner } from '../../partners/models/Partner.model';
import { PartnerService } from '../../partners/services/partner.service';
import {
    buildDepartmentFilter,
    getDepartmentCatalog,
    resolveDepartmentValue,
} from '../../../utils/department.util';

export interface UserFilters {
    search?: string;
    role?: string;
    department?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export interface CreateUserData {
    name: string;
    email: string;
    password: string;
    role: string; // role ID
    department?: string;
}

export interface UpdateUserData {
    name?: string;
    email?: string;
    role?: string;
    department?: string;
    isActive?: boolean;
    modulePermissions?: Record<string, any>;
}

const createDefaultModulePermissions = () => ({
    accessControlVersion: 2,
    projectManagement: { enabled: true, adminAccess: false, projectPermissions: [] },
    finance: {
        enabled: false,
        adminAccess: false,
        subModules: {
            dashboard: false,
            revenue: false,
            cashInBank: false,
            expenses: false,
            salariesPayrolls: false,
            invoices: false,
            reports: false,
        },
    },
    crm: {
        enabled: false,
        adminAccess: false,
        subModules: { pipeline: false, leads: false, proposals: false, clients: false },
    },
    hrms: {
        enabled: true,
        adminAccess: false,
        subModules: { dashboard: false, employees: false, attendance: true, leaves: true, holidays: true, payroll: true, announcements: true },
    },
    overallAdmin: {
        enabled: false,
        adminAccess: false,
        subModules: { users: false, permissions: false, settings: false, auditLogs: false },
    },
    partners: { enabled: false, adminAccess: false },
    hiring: { enabled: false, adminAccess: false },
});

const normalizeModulePermissionsForSave = (modulePermissions: Record<string, any>) => {
    const defaults = createDefaultModulePermissions();
    const merged: any = {
        ...defaults,
        ...modulePermissions,
        accessControlVersion: 2,
    };

    Object.keys(defaults).forEach((key) => {
        if (key === 'accessControlVersion') return;
        const current = modulePermissions?.[key] || {};
        merged[key] = {
            ...(defaults as any)[key],
            ...current,
            adminAccess: current.adminAccess === true,
        };
        if ((defaults as any)[key].subModules) {
            merged[key].subModules = {
                ...(defaults as any)[key].subModules,
                ...(current.subModules || {}),
            };
        }
        if (merged[key].adminAccess) {
            merged[key].enabled = true;
        }
    });

    return merged;
};

const attachDerivedAccess = async (users: any[]) => {
    const plainUsers = users.map((user) => user?.toObject ? user.toObject() : user);
    const userIds = plainUsers.map((user) => user._id?.toString()).filter(Boolean);

    if (userIds.length === 0) return plainUsers;

    const employees = await Employee.find({ userId: { $in: userIds } }).select('_id userId').lean();
    const employeeIdToUserId = new Map<string, string>();
    employees.forEach((employee: any) => {
        employeeIdToUserId.set(employee._id.toString(), employee.userId.toString());
    });

    const managedEmployeeIds = await Job.distinct('managers', {
        managers: { $in: employees.map((employee: any) => employee._id) },
    });
    const hiringManagerUserIds = new Set<string>();
    managedEmployeeIds.forEach((employeeId: any) => {
        const userId = employeeIdToUserId.get(employeeId.toString());
        if (userId) hiringManagerUserIds.add(userId);
    });

    return plainUsers.map((user) => ({
        ...user,
        derivedAccess: {
            ...(user.derivedAccess || {}),
            hiringJobManager: hiringManagerUserIds.has(user._id?.toString()),
        },
    }));
};

/**
 * Get all users with filters and pagination
 */
export const getAllUsers = async (filters: UserFilters) => {
    const { search, role, department, isActive, page = 1, limit = 20 } = filters;

    const query: any = {};

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }

    if (role) {
        query.role = role;
    }

    if (department) {
        query.department = buildDepartmentFilter(department);
    }

    if (isActive !== undefined) {
        query.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
        User.find(query)
            .populate('role', 'name level')
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        User.countDocuments(query),
    ]);
    const usersWithDerivedAccess = await attachDerivedAccess(users);

    return {
        users: usersWithDerivedAccess,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};

/**
 * Get user by ID with full details
 */
export const getUserById = async (id: string) => {
    const user = await User.findById(id)
        .populate({
            path: 'role',
            populate: { path: 'permissions' },
        })
        .select('-password');

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const [userWithDerivedAccess] = await attachDerivedAccess([user]);
    return userWithDerivedAccess;
};

/**
 * Create a new user
 */
export const createUser = async (data: CreateUserData, adminId: string) => {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
        throw new AppError('User with this email already exists', 400);
    }

    const role = await Role.findById(data.role);
    if (!role) {
        throw new AppError('Invalid role specified', 400);
    }

    const departmentCatalog = await getDepartmentCatalog();
    const user = await User.create({
        name: data.name,
        email: data.email,
        password: data.password,
        role: role._id,
        department: resolveDepartmentValue(data.department, departmentCatalog) || undefined,
        modulePermissions: createDefaultModulePermissions(),
    });

    await user.populate('role', 'name level');

    // Audit log
    await AuditLog.create({
        userId: adminId,
        action: 'user_created',
        resource: 'user',
        resourceId: (user._id as any).toString(),
        details: { name: data.name, email: data.email, role: role.name },
    });

    return user;
};

/**
 * Update user
 */
export const updateUser = async (id: string, data: UpdateUserData, adminId: string) => {
    const user = await User.findById(id);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    if (data.role) {
        const role = await Role.findById(data.role);
        if (!role) {
            throw new AppError('Invalid role specified', 400);
        }
    }

    if (data.email && data.email !== user.email) {
        const existingUser = await User.findOne({ email: data.email });
        if (existingUser) {
            throw new AppError('Email already in use', 400);
        }
    }

    const shouldToggleActive =
        typeof data.isActive === 'boolean' && data.isActive !== user.isActive;

    const updatePayload: UpdateUserData = { ...data };
    if ('department' in updatePayload) {
        const departmentCatalog = await getDepartmentCatalog();
        updatePayload.department =
            resolveDepartmentValue(updatePayload.department, departmentCatalog) || undefined;
    }
    if (shouldToggleActive) {
        delete updatePayload.isActive;
    }
    if (updatePayload.modulePermissions) {
        updatePayload.modulePermissions = normalizeModulePermissionsForSave(updatePayload.modulePermissions);
    }

    if (Object.keys(updatePayload).length > 0) {
        await User.findByIdAndUpdate(id, updatePayload, { new: true });
    }

    if (shouldToggleActive) {
        const partner = await Partner.findOne({ userId: id }).select('_id').lean();

        if (partner) {
            const partnerService = new PartnerService();
            if (data.isActive) {
                await partnerService.activatePartner(partner._id.toString());
            } else {
                await partnerService.deactivatePartner(partner._id.toString());
            }
        } else {
            await User.findByIdAndUpdate(id, { $set: { isActive: data.isActive } });
        }
    }

    const updated = await User.findById(id)
        .populate('role', 'name level')
        .select('-password');

    // Audit log
    await AuditLog.create({
        userId: adminId,
        action: 'user_updated',
        resource: 'user',
        resourceId: id,
        details: data,
    });

    return updated;
};

/**
 * Deactivate user
 */
export const deactivateUser = async (id: string, adminId: string) => {
    const user = await User.findById(id);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Prevent self-deactivation
    if (id === adminId) {
        throw new AppError('Cannot deactivate your own account', 400);
    }

    const partner = await Partner.findOne({ userId: id }).select('_id').lean();

    if (partner) {
        const partnerService = new PartnerService();
        await partnerService.deactivatePartner(partner._id.toString());
    } else {
        user.isActive = false;
        await user.save();
    }

    await AuditLog.create({
        userId: adminId,
        action: 'user_deactivated',
        resource: 'user',
        resourceId: id,
        details: { name: user.name, email: user.email },
    });

    return user;
};

/**
 * Activate user
 */
export const activateUser = async (id: string, adminId: string) => {
    const user = await User.findById(id);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    const partner = await Partner.findOne({ userId: id }).select('_id').lean();

    if (partner) {
        const partnerService = new PartnerService();
        await partnerService.activatePartner(partner._id.toString());
    } else {
        user.isActive = true;
        await user.save();
    }

    await AuditLog.create({
        userId: adminId,
        action: 'user_activated',
        resource: 'user',
        resourceId: id,
        details: { name: user.name, email: user.email },
    });

    return user;
};

/**
 * Reset user password
 */
export const resetPassword = async (id: string, newPassword: string, adminId: string) => {
    const user = await User.findById(id).select('+password');
    if (!user) {
        throw new AppError('User not found', 404);
    }

    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();

    await AuditLog.create({
        userId: adminId,
        action: 'password_reset',
        resource: 'user',
        resourceId: id,
        details: { name: user.name, email: user.email },
    });

    return { message: 'Password reset successfully' };
};

/**
 * Delete user (hard delete)
 */
export const deleteUser = async (id: string, adminId: string) => {
    const user = await User.findById(id);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    if (id === adminId) {
        throw new AppError('Cannot delete your own account', 400);
    }

    await User.findByIdAndDelete(id);

    // Cascade: Deactivate associated employee if it exists
    await Employee.findOneAndUpdate(
        { userId: id },
        { status: 'terminated' }
    );

    await AuditLog.create({
        userId: adminId,
        action: 'user_deleted',
        resource: 'user',
        resourceId: id,
        details: { name: user.name, email: user.email },
    });

    return { message: 'User deleted successfully' };
};
