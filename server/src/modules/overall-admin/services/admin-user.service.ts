import { User, IUser } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import { Types } from 'mongoose';
import AppError from '../../../utils/appError';
import { AuditLog } from '../models/AuditLog.model';
import { Employee } from '../../hrms/models/Employee.model';
import { Job } from '../../hiring/models/Job.model';
import { Partner } from '../../partners/models/Partner.model';
import { PartnerService } from '../../partners/services/partner.service';
import { Notification } from '../../notification/models/Notification.model';
import { DeleteGraphResult, DeleteGraphService } from '../../archive';
import {
    buildDepartmentFilter,
    getDepartmentCatalog,
    resolveDepartmentValue,
} from '../../../utils/department.util';
import { Project } from '../../project/models/Project.model';
import { Task } from '../../project/models/Task.model';
import { Meeting } from '../../project/models/Meeting.model';
import { Lead } from '../../crm/models/Lead.model';
import { InterviewNotification } from '../../hiring/models/InterviewNotification.model';
import { Leave } from '../../hrms/models/Leave.model';
import { Payroll } from '../../hrms/models/Payroll.model';

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

const getGraphNodeIds = (graph: DeleteGraphResult, relationship: string): Types.ObjectId[] => (
    graph.nodes.find((node) => node.relationship === relationship)?.sourceIds ?? []
);

/**
 * Removes a user's presence from all modules where they are an optional member,
 * participant, or assignee — without deleting any shared business data.
 *
 * @param userId   The ObjectId of the user being deleted.
 * @param employeeId  The ObjectId of the associated Employee record, if any.
 */
export const cleanupUserMemberships = async (
    userId: string,
    employeeId?: string | null,
): Promise<void> => {
    const userOid = new Types.ObjectId(userId);

    await Promise.all([
        // ── Project Module ───────────────────────────────────────────────
        // Remove user from project assignee list
        Project.updateMany(
            { 'assignees.userId': userOid },
            { $pull: { assignees: { userId: userOid } } }
        ),
        // Remove user from credential admins
        Project.updateMany(
            { credentialAdmins: userOid },
            { $pull: { credentialAdmins: userOid } }
        ),
        // Remove user from document admins
        Project.updateMany(
            { docAdmins: userOid },
            { $pull: { docAdmins: userOid } }
        ),

        // ── Task Module ──────────────────────────────────────────────────
        // Remove user from task assignees
        Task.updateMany(
            { assignees: userOid },
            { $pull: { assignees: userOid } }
        ),
        // Remove user's active timers from tasks
        Task.updateMany(
            { 'activeTimers.userId': userOid },
            { $pull: { activeTimers: { userId: userOid } } }
        ),
        // Remove user's accumulated seconds entries from tasks
        Task.updateMany(
            { 'accumulatedSeconds.userId': userOid },
            { $pull: { accumulatedSeconds: { userId: userOid } } }
        ),

        // ── Meeting Module ───────────────────────────────────────────────
        // Remove user from meeting participants
        Meeting.updateMany(
            { 'participants.userId': userOid },
            { $pull: { participants: { userId: userOid } } }
        ),
        // Remove user from custom access list
        Meeting.updateMany(
            { customAccessUsers: userOid },
            { $pull: { customAccessUsers: userOid } }
        ),
        // Unset action item assignments belonging to this user
        Meeting.updateMany(
            { 'actionItems.assignedTo': userOid },
            { $unset: { 'actionItems.$[elem].assignedTo': '' } },
            { arrayFilters: [{ 'elem.assignedTo': userOid }] }
        ),

        // ── CRM Module ───────────────────────────────────────────────────
        // Unset lead assignee
        Lead.updateMany(
            { assignedTo: userOid },
            { $unset: { assignedTo: '' } }
        ),

        // ── Hiring Module ────────────────────────────────────────────────
        // Delete interview notifications sent to this user
        InterviewNotification.deleteMany({ userId: userOid }),

        // ── HRMS Module ──────────────────────────────────────────────────
        // Unset leave approver
        Leave.updateMany(
            { approvedBy: userOid },
            { $unset: { approvedBy: '' } }
        ),
        // Unset payroll approver
        Payroll.updateMany(
            { approvedBy: userOid },
            { $unset: { approvedBy: '' } }
        ),
    ]);

    // ── Hiring: remove employee from job managers ─────────────────────
    // Job.managers stores Employee ObjectIds, not User ObjectIds directly.
    if (employeeId) {
        const employeeOid = new Types.ObjectId(employeeId);
        await Job.updateMany(
            { managers: employeeOid },
            { $pull: { managers: employeeOid } }
        );
    }
};

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
    const employee = await Employee.findOne({ userId: id }).select('_id').lean();

    if (partner) {
        const partnerService = new PartnerService();
        await partnerService.deactivatePartner(partner._id.toString());
    } else {
        user.isActive = false;
        await user.save();
    }

    // Remove user's presence from project assignees, meetings, tasks etc.
    // so they no longer appear as ghost members in the UI.
    await cleanupUserMemberships(id, employee?._id?.toString());

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
 * Delete user after archiving the user graph. Historical createdBy/updatedBy references are preserved.
 */
export const deleteUser = async (id: string, adminId: string) => {
    const user = await User.findById(id);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    if (id === adminId) {
        throw new AppError('Cannot delete your own account', 400);
    }

    // Resolve the employee record (if any) before deletion so we have the ID
    // for removing the employee from job managers in Hiring module.
    const employee = await Employee.findOne({ userId: id }).select('_id').lean();

    // Step 1: Remove user's presence from all modules (assignees, participants,
    // approvers, etc.) without touching shared business data.
    await cleanupUserMemberships(id, employee?._id?.toString());

    // Step 2: Archive and delete the user record and its owned graph
    const graph = await DeleteGraphService.archiveGraph('User', id, {
        deletedBy: adminId,
        reason: 'Admin user delete requested',
        metadata: {
            userId: id,
            email: user.email,
            name: user.name,
            preservesHistoricalReferences: true,
        },
    });

    await Notification.deleteMany({ _id: { $in: getGraphNodeIds(graph, 'user_notifications') } });
    await user.deleteOne();

    // Step 3: Mark associated employee as terminated (record kept for payroll history)
    if (employee) {
        await Employee.findByIdAndUpdate(employee._id, { status: 'terminated' });
    }

    await AuditLog.create({
        userId: adminId,
        action: 'user_deleted',
        resource: 'user',
        resourceId: id,
        details: { name: user.name, email: user.email },
    });

    return { message: 'User deleted successfully' };
};
