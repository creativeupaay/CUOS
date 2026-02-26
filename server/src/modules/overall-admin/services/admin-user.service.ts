import { User, IUser } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import AppError from '../../../utils/appError';
import { AuditLog } from '../models/AuditLog.model';
import { Employee } from '../../hrms/models/Employee.model';
import bcrypt from 'bcryptjs';

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
        query.department = department;
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

    return {
        users,
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

    return user;
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

    const user = await User.create({
        name: data.name,
        email: data.email,
        password: data.password,
        role: role._id,
        department: data.department,
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

    const updated = await User.findByIdAndUpdate(id, data, { new: true })
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

    user.isActive = false;
    await user.save();

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

    user.isActive = true;
    await user.save();

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
