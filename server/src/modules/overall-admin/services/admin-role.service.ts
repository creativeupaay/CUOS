import { Role, IRole } from '../../auth/models/Role.model';
import { Permission } from '../../auth/models/Permission.model';
import { User } from '../../auth/models/User.model';
import { AuditLog } from '../models/AuditLog.model';
import AppError from '../../../utils/appError';

export interface CreateRoleData {
    name: string;
    description: string;
    permissions: string[]; // Permission IDs
    level: number;
}

export interface UpdateRoleData {
    name?: string;
    description?: string;
    permissions?: string[];
    level?: number;
}

/**
 * Get all roles with permission counts
 */
export const getAllRoles = async () => {
    const roles = await Role.find()
        .populate('permissions', 'resource action description')
        .sort({ level: 1 });

    return roles;
};

/**
 * Get role by ID with full permissions
 */
export const getRoleById = async (id: string) => {
    const role = await Role.findById(id).populate('permissions');

    if (!role) {
        throw new AppError('Role not found', 404);
    }

    // Count users with this role
    const userCount = await User.countDocuments({ role: id });

    return { role, userCount };
};

/**
 * Create a new role
 */
export const createRole = async (data: CreateRoleData, adminId: string) => {
    const existingRole = await Role.findOne({ name: data.name.toLowerCase() });
    if (existingRole) {
        throw new AppError('Role with this name already exists', 400);
    }

    // Validate permissions exist
    if (data.permissions.length > 0) {
        const validPermissions = await Permission.countDocuments({
            _id: { $in: data.permissions },
        });
        if (validPermissions !== data.permissions.length) {
            throw new AppError('Some permissions are invalid', 400);
        }
    }

    const role = await Role.create({
        name: data.name.toLowerCase(),
        description: data.description,
        permissions: data.permissions,
        level: data.level,
    });

    await role.populate('permissions');

    await AuditLog.create({
        userId: adminId,
        action: 'role_created',
        resource: 'role',
        resourceId: (role._id as any).toString(),
        details: { name: role.name, permissionCount: data.permissions.length },
    });

    return role;
};

/**
 * Update a role
 */
export const updateRole = async (id: string, data: UpdateRoleData, adminId: string) => {
    const role = await Role.findById(id);
    if (!role) {
        throw new AppError('Role not found', 404);
    }

    // Don't allow renaming super-admin
    if (role.name === 'super-admin' && data.name && data.name !== 'super-admin') {
        throw new AppError('Cannot rename the super-admin role', 400);
    }

    if (data.name && data.name.toLowerCase() !== role.name) {
        const existing = await Role.findOne({ name: data.name.toLowerCase() });
        if (existing) {
            throw new AppError('Role with this name already exists', 400);
        }
    }

    if (data.permissions && data.permissions.length > 0) {
        const validPermissions = await Permission.countDocuments({
            _id: { $in: data.permissions },
        });
        if (validPermissions !== data.permissions.length) {
            throw new AppError('Some permissions are invalid', 400);
        }
    }

    const updated = await Role.findByIdAndUpdate(
        id,
        {
            ...(data.name && { name: data.name.toLowerCase() }),
            ...(data.description && { description: data.description }),
            ...(data.permissions && { permissions: data.permissions }),
            ...(data.level && { level: data.level }),
        },
        { new: true }
    ).populate('permissions');

    await AuditLog.create({
        userId: adminId,
        action: 'role_updated',
        resource: 'role',
        resourceId: id,
        details: data,
    });

    return updated;
};

/**
 * Delete a role (only if no users assigned)
 */
export const deleteRole = async (id: string, adminId: string) => {
    const role = await Role.findById(id);
    if (!role) {
        throw new AppError('Role not found', 404);
    }

    // Prevent deletion of core roles
    const protectedRoles = ['super-admin', 'admin', 'employee'];
    if (protectedRoles.includes(role.name)) {
        throw new AppError(`Cannot delete the ${role.name} role`, 400);
    }

    // Check if any users have this role
    const userCount = await User.countDocuments({ role: id });
    if (userCount > 0) {
        throw new AppError(`Cannot delete role — ${userCount} user(s) still assigned`, 400);
    }

    await Role.findByIdAndDelete(id);

    await AuditLog.create({
        userId: adminId,
        action: 'role_deleted',
        resource: 'role',
        resourceId: id,
        details: { name: role.name },
    });

    return { message: 'Role deleted successfully' };
};

/**
 * Clone a role
 */
export const cloneRole = async (id: string, newName: string, adminId: string) => {
    const sourceRole = await Role.findById(id).populate('permissions');
    if (!sourceRole) {
        throw new AppError('Source role not found', 404);
    }

    const existingRole = await Role.findOne({ name: newName.toLowerCase() });
    if (existingRole) {
        throw new AppError('Role with this name already exists', 400);
    }

    const clonedRole = await Role.create({
        name: newName.toLowerCase(),
        description: `Cloned from ${sourceRole.name}: ${sourceRole.description}`,
        permissions: sourceRole.permissions.map((p: any) => p._id || p),
        level: sourceRole.level,
    });

    await clonedRole.populate('permissions');

    await AuditLog.create({
        userId: adminId,
        action: 'role_cloned',
        resource: 'role',
        resourceId: (clonedRole._id as any).toString(),
        details: { sourceName: sourceRole.name, newName: clonedRole.name },
    });

    return clonedRole;
};

/**
 * Get all permissions grouped by resource
 */
export const getAllPermissions = async () => {
    const permissions = await Permission.find().sort({ resource: 1, action: 1 });

    // Group by resource
    const grouped: Record<string, any[]> = {};
    permissions.forEach((p) => {
        if (!grouped[p.resource]) {
            grouped[p.resource] = [];
        }
        grouped[p.resource].push(p);
    });

    return { permissions, grouped };
};

/**
 * Create a new permission
 */
export const createPermission = async (
    data: { resource: string; action: string; description: string },
    adminId: string
) => {
    const existing = await Permission.findOne({
        resource: data.resource.toLowerCase(),
        action: data.action.toLowerCase(),
    });
    if (existing) {
        throw new AppError('Permission already exists for this resource:action', 400);
    }

    const permission = await Permission.create({
        resource: data.resource.toLowerCase(),
        action: data.action.toLowerCase(),
        description: data.description,
    });

    await AuditLog.create({
        userId: adminId,
        action: 'permission_created',
        resource: 'permission',
        resourceId: (permission._id as any).toString(),
        details: { resource: data.resource, action: data.action },
    });

    return permission;
};

/**
 * Delete a permission (only if not assigned to any role)
 */
export const deletePermission = async (id: string, adminId: string) => {
    const permission = await Permission.findById(id);
    if (!permission) {
        throw new AppError('Permission not found', 404);
    }

    // Check if any roles use this permission
    const roleCount = await Role.countDocuments({ permissions: id });
    if (roleCount > 0) {
        throw new AppError(`Cannot delete — ${roleCount} role(s) still use this permission`, 400);
    }

    await Permission.findByIdAndDelete(id);

    await AuditLog.create({
        userId: adminId,
        action: 'permission_deleted',
        resource: 'permission',
        resourceId: id,
        details: { resource: permission.resource, action: permission.action },
    });

    return { message: 'Permission deleted successfully' };
};
