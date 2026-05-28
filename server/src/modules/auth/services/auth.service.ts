import { User, IUser } from '../models/User.model';
import { Role, IRole } from '../models/Role.model';
import AppError from '../../../utils/appError';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    TokenPayload,
} from '../utils/jwt.util';
import { getDepartmentCatalog, resolveDepartmentValue } from '../../../utils/department.util';
import { logger } from "../../../utils/logger";
import { Document, Types } from 'mongoose';

/** Safely extract role name from a populated or unpopulated role field */
function getRoleName(role: IUser['role']): string {
    if (!role) return '';
    if (role instanceof Types.ObjectId) return '';
    return (role as IRole).name?.toLowerCase() || '';
}

export interface RegisterData {
    name?: string;
    email: string;
    password: string;
    role?: string;
    department?: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface AuthResponse {
    user: IUser;
    accessToken: string;
    refreshToken: string;
}

type UserListRequester = {
    id?: string;
    role?: string;
    partnerId?: string;
    isPartnerEmployee?: boolean;
};

// Minimal type for empty subModules placeholder in partner employee permissions
type IModuleSubset = Record<string, never>;

const buildPartnerEmployeeModulePermissions = (modulePermissions?: {
    projectManagement?: boolean;
    crm?: boolean;
    teamManagement?: boolean;
}) => ({
    projectManagement: {
        enabled: modulePermissions?.projectManagement ?? true,
        projectPermissions: [],
    },
    crm: {
        enabled: modulePermissions?.crm ?? false,
        subModules: {
            pipeline: false,
            leads: false,
            proposals: false,
            clients: true,
        },
    },
    teamManagement: {
        enabled: modulePermissions?.teamManagement ?? false,
    },
    finance: {
        enabled: false,
        subModules: {} as IModuleSubset,
    },
    hrms: {
        enabled: false,
        subModules: {} as IModuleSubset,
    },
    overallAdmin: {
        enabled: false,
        subModules: {} as IModuleSubset,
    },
});

const buildDefaultInternalModulePermissions = () => ({
    accessControlVersion: 2,
    projectManagement: { enabled: true, adminAccess: false, projectPermissions: [] },
    finance: { enabled: false, adminAccess: false, subModules: { dashboard: false, revenue: false, cashInBank: false, expenses: false, salariesPayrolls: false, invoices: false, reports: false } },
    crm: { enabled: false, adminAccess: false, subModules: { pipeline: false, leads: false, proposals: false, clients: false } },
    hrms: { enabled: true, adminAccess: false, subModules: { dashboard: false, employees: false, attendance: true, leaves: true, holidays: true, payroll: true, announcements: true } },
    overallAdmin: { enabled: false, adminAccess: false, subModules: { users: false, permissions: false, settings: false, auditLogs: false } },
    partners: { enabled: false, adminAccess: false },
    hiring: { enabled: false, adminAccess: false },
});

/**
 * Register a new user
 */
export const register = async (data: RegisterData): Promise<IUser> => {
    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
        throw new AppError('User with this email already exists', 400);
    }

    // Get role
    let role;
    if (data.role) {
        role = await Role.findOne({ name: data.role.toLowerCase() });
        if (!role) {
            throw new AppError('Invalid role specified', 400);
        }
    } else {
        // Default to employee role
        role = await Role.findOne({ name: 'employee' });
        if (!role) {
            throw new AppError('Default role not found. Please seed roles first.', 500);
        }
    }

    // Create user
    const departmentCatalog = await getDepartmentCatalog();
    const user = await User.create({
        name: data.name,
        email: data.email,
        password: data.password,
        role: role._id,
        department: resolveDepartmentValue(data.department, departmentCatalog) || undefined,
        modulePermissions: buildDefaultInternalModulePermissions(),
    });

    // Populate role
    await user.populate('role');

    return user;
};

/**
 * Login user (BLOCKS partner role from using this endpoint)
 */
export const login = async (data: LoginData): Promise<AuthResponse> => {
    // Find user with password field
    const user = await User.findOne({ email: data.email })
        .select('+password')
        .populate<{ role: IRole }>('role');

    if (!user) {
        throw new AppError('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
        throw new AppError('Your account has been deactivated', 403);
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(data.password);
    if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
    }

    // Get role name
    if (!user.role) {
        throw new AppError('User role not found. Please contact an administrator.', 500);
    }
    const roleName = getRoleName(user.role) || 'employee';

    // BLOCK PARTNERS from using regular login
    if (roleName === 'partner') {
        throw new AppError('Partners must use the partner login portal', 403);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const tokenPayload: TokenPayload = {
        userId: (user._id as unknown as { toString(): string }).toString(),
        email: user.email,
        role: roleName,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Remove password from response
    const userObj = user.toObject() as unknown as Record<string, unknown>;
    delete userObj.password;

    return {
        user: userObj as unknown as IUser,
        accessToken,
        refreshToken,
    };
};

/**
 * Partner login (Supports both Partner users and PartnerEmployee users)
 * Validates that the partner belongs to the correct portal by slug
 */
export const partnerLogin = async (data: LoginData, slug: string): Promise<AuthResponse> => {
    // First, validate the partner portal exists via slug
    const { Partner } = await import('../../partners/models/Partner.model');
    const partnerPortal = await Partner.findOne({ slug, registrationStatus: 'completed' })
        .populate('userId', 'email');

    if (!partnerPortal) {
        throw new AppError('Invalid partner portal', 404);
    }

    if (!partnerPortal.isActive) {
        throw new AppError('This partner portal is currently disabled', 403);
    }

    // First, try to find as a regular partner user
    let user: IUser | null = (await User.findOne({ email: data.email })
        .select('+password')
        .populate<{ role: IRole }>('role')) as unknown as IUser | null;

    let isPartnerEmployee = false;
    let partnerIdForEmployee: string | null = null;
    let partnerEmployeeModulePermissions: {
        projectManagement?: boolean;
        crm?: boolean;
        teamManagement?: boolean;
    } | undefined;
    let belongsToThisPortal = false;

    const normalizeEntityId = (value: unknown): string | null => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (typeof value === 'object' && '_id' in value && (value as { _id: unknown })._id) {
            return String((value as { _id: { toString(): string } })._id.toString());
        }
        if (typeof (value as { toString?: () => string }).toString === 'function') {
            return (value as { toString(): string }).toString();
        }
        return null;
    };

    if (user) {
        // Check if user is active
        if (!user.isActive) {
            throw new AppError('Your account has been deactivated', 403);
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(data.password);
        if (!isPasswordValid) {
            throw new AppError('Invalid email or password', 401);
        }

        // Get role name
        if (!user.role) {
            throw new AppError('User role not found. Please contact an administrator.', 500);
        }
        const roleName = getRoleName(user.role) || 'employee';

        // ONLY ALLOW PARTNERS to use partner login
        if (roleName !== 'partner') {
            throw new AppError('This login portal is only for partners', 403);
        }

        // Validate this user belongs to the partner portal they're trying to access
        const portalUserId = normalizeEntityId(partnerPortal.userId);
        belongsToThisPortal = portalUserId === (user._id as unknown as { toString(): string }).toString();
    } else {
        // If not found as User, check if it's a PartnerEmployee
        const { PartnerEmployee } = await import('../../partners/models/PartnerEmployee.model');
        const partnerEmployee = await PartnerEmployee.findOne({ email: data.email })
            .select('+password')
            .populate('partnerId');

        if (!partnerEmployee) {
            throw new AppError('Invalid email or password', 401);
        }

        // Check if partner employee is active
        if (!partnerEmployee.isActive) {
            throw new AppError('Your account has been deactivated', 403);
        }

        // Verify password
        const isPasswordValid = await partnerEmployee.comparePassword(data.password);
        if (!isPasswordValid) {
            throw new AppError('Invalid email or password', 401);
        }

        // Validate this employee belongs to the partner portal they're trying to access
        const employeePartnerId = normalizeEntityId(partnerEmployee.partnerId);
        belongsToThisPortal = employeePartnerId === partnerPortal._id.toString();

        // Mark as partner employee and store parent partnerId
        isPartnerEmployee = true;
        partnerIdForEmployee = normalizeEntityId(partnerEmployee.partnerId);
        partnerEmployeeModulePermissions = partnerEmployee.modulePermissions;

        // Create a user-like object for partner employee
        user = {
            _id: partnerEmployee._id,
            email: partnerEmployee.email,
            name: partnerEmployee.name,
            role: 'partner' as unknown as IUser['role'], // Treat partner employees as partners for access control
            isActive: partnerEmployee.isActive,
            partnerId: normalizeEntityId(partnerEmployee.partnerId),
            isPartnerEmployee: true,
            save: async function(this: { _id: unknown; email: string; name: string; isActive: boolean; partnerId: unknown }) { return this; },
            toObject: function(this: { _id: unknown; email: string; name: string; isActive: boolean; partnerId: unknown }) {
                return {
                    _id: this._id,
                    email: this.email,
                    name: this.name,
                    role: 'partner',
                    isActive: this.isActive,
                    partnerId: this.partnerId,
                    isPartnerEmployee: true,
                    modulePermissions: buildPartnerEmployeeModulePermissions(partnerEmployee.modulePermissions),
                };
            },
        } as unknown as IUser;
    }

    // Check if user belongs to this partner portal
    if (!belongsToThisPortal) {
        throw new AppError('You are not authorized to use this login portal. Please use your own partner portal.', 403);
    }

    // Update last login (only for regular partner users, not employees)
    if (!isPartnerEmployee && user?.save) {
        (user as IUser).lastLogin = new Date();
        await user.save();
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
        userId: user ? (user._id as unknown as { toString(): string }).toString() : '',
        email: user?.email || '',
        role: 'partner', // Always 'partner' for access control
    };

    // Add partnerId for partner employees (extend payload with a non-standard claim)
    if (isPartnerEmployee && partnerIdForEmployee) {
        (tokenPayload as TokenPayload & { partnerIdOverride: string }).partnerIdOverride = partnerIdForEmployee;
    }

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Remove password from response
    const userObj = user?.toObject
        ? (user.toObject() as unknown as Record<string, unknown>)
        : ({ ...(user || {}) } as Record<string, unknown>);
    delete userObj.password;

    // Add partner info to response
    userObj.partnerId = partnerPortal._id;
    userObj.partnerSlug = partnerPortal.slug;
    userObj.companyName = partnerPortal.companyName;
    userObj.companyLogo = partnerPortal.companyLogo;

    // Add partnerId to response for partner employees
    if (isPartnerEmployee) {
        userObj.partnerId = partnerIdForEmployee;
        userObj.isPartnerEmployee = true;
        userObj.modulePermissions = buildPartnerEmployeeModulePermissions(partnerEmployeeModulePermissions);
    }

    return {
        user: userObj as unknown as IUser,
        accessToken,
        refreshToken,
    };
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (
    refreshToken: string
): Promise<{ accessToken: string }> => {
    try {
        // Verify refresh token
        const payload = verifyRefreshToken(refreshToken);

        // Generate new access token
        const accessToken = generateAccessToken(payload);

        return { accessToken };
    } catch (error) {
        logger.info({ context: error }, 'Error refreshing access token:');
        throw new AppError('Invalid or expired refresh token', 401);
    }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<IUser | null> => {
    const user = await User.findById(userId).populate('role');
    return user;
};

/**
 * Get current user
 */
export const getCurrentUser = async (userId: string): Promise<IUser> => {
    const user = await User.findById(userId).populate<{
        role: IRole;
    }>({
        path: 'role',
        populate: {
            path: 'permissions',
        },
    });

    if (!user) {
        const { PartnerEmployee } = await import('../../partners/models/PartnerEmployee.model');
        const { Partner } = await import('../../partners/models/Partner.model');

        const partnerEmployee = await PartnerEmployee.findById(userId).lean();

        if (!partnerEmployee) {
            throw new AppError('User not found', 404);
        }

        const partnerPortal = await Partner.findById(partnerEmployee.partnerId)
            .select('slug companyName companyLogo')
            .lean();

        return {
            _id: partnerEmployee._id,
            name: partnerEmployee.name,
            email: partnerEmployee.email,
            role: 'partner' as unknown as IUser['role'],
            isActive: partnerEmployee.isActive,
            createdAt: partnerEmployee.createdAt,
            updatedAt: partnerEmployee.updatedAt,
            partnerId: partnerEmployee.partnerId as unknown as Types.ObjectId,
            partnerSlug: partnerPortal?.slug,
            companyName: partnerPortal?.companyName,
            companyLogo: partnerPortal?.companyLogo,
            isPartnerEmployee: true,
            modulePermissions: buildPartnerEmployeeModulePermissions(partnerEmployee.modulePermissions),
        } as unknown as IUser;
    }

    const roleName = getRoleName(user.role).toLowerCase();

    if (roleName === 'partner') {
        const { Partner } = await import('../../partners/models/Partner.model');
        const partnerPortal = await Partner.findOne({ userId: user._id })
            .select('slug companyName companyLogo')
            .lean();

        if (partnerPortal) {
            const userObj = user.toObject() as unknown as IUser & {
                partnerId?: Types.ObjectId;
                partnerSlug?: string;
                companyName?: string;
                companyLogo?: string;
            };

            userObj.partnerId = partnerPortal._id as unknown as Types.ObjectId;
            userObj.partnerSlug = partnerPortal.slug;
            userObj.companyName = partnerPortal.companyName;
            userObj.companyLogo = partnerPortal.companyLogo;

            return userObj;
        }
    }

    return user as unknown as IUser;
};

/**
 * Get all users
 */
export const getAllUsers = async (requester?: UserListRequester): Promise<IUser[]> => {
    const requesterRole = String(requester?.role || '').toLowerCase();

    if (requesterRole !== 'partner') {
        const users = await User.find()
            .select('name email role department isActive')
            .populate('role', 'name');
        return users;
    }

    const { Partner } = await import('../../partners/models/Partner.model');
    const { PartnerEmployee } = await import('../../partners/models/PartnerEmployee.model');

    let partnerId = requester?.partnerId;

    if (!partnerId && requester?.id && !requester?.isPartnerEmployee) {
        const partnerRecord = await Partner.findOne({ userId: requester.id }).select('_id').lean();
        partnerId = partnerRecord?._id?.toString();
    }

    const superAdminRoles = await Role.find({
        name: { $in: ['super-admin', 'super_admin'] },
    }).select('_id');

    const superAdminRoleIds = superAdminRoles.map((role) => role._id);

    const superAdmins = await User.find({
        role: { $in: superAdminRoleIds },
        isActive: true,
    })
        .select('name email role department isActive')
        .populate('role', 'name')
        .lean();

    type PartialUserView = Pick<IUser, '_id' | 'name' | 'email' | 'isActive' | 'department'> & {
        role?: { name: string } | unknown;
    };
    const partnerMainUser: PartialUserView[] = [];
    const partnerTeamMembers: PartialUserView[] = [];

    if (partnerId) {
        const partner = await Partner.findById(partnerId)
            .populate({
                path: 'userId',
                select: 'name email role department isActive',
                populate: { path: 'role', select: 'name' },
            })
            .select('userId')
            .lean();

        const partnerWithUser = partner as typeof partner & { userId?: PartialUserView };
        const partnerUser = partnerWithUser?.userId;
        if (partnerUser?._id) {
            partnerMainUser.push(partnerUser);
        }

        const partnerEmployees = await PartnerEmployee.find({
            partnerId,
            isActive: true,
        })
            .select('_id name email isActive')
            .lean();

        for (const member of partnerEmployees) {
            partnerTeamMembers.push({
                _id: member._id,
                name: member.name,
                email: member.email,
                isActive: member.isActive,
                department: 'partner-team',
                role: { name: 'partner-employee' },
            });
        }
    }

    const merged = [...superAdmins, ...partnerMainUser, ...partnerTeamMembers];
    const seen = new Set<string>();

    return (merged as IUser[]).filter((user) => {
        const id = user?._id?.toString?.() || String(user?._id || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

/**
 * Change current user's password
 */
export const changePassword = async (
    userId: string,
    oldPassword: string,
    newPassword: string
): Promise<void> => {
    type UserWithPassword = { comparePassword(p: string): Promise<boolean>; password: string; save(): Promise<unknown> };
    let user: UserWithPassword | null = await User.findById(userId).select('+password') as UserWithPassword | null;

    if (!user) {
        const { PartnerEmployee } = await import('../../partners/models/PartnerEmployee.model');
        user = await PartnerEmployee.findById(userId).select('+password');

        if (!user) {
            throw new AppError('User not found', 404);
        }
    }

    const isOldPasswordValid = await user.comparePassword(oldPassword);
    if (!isOldPasswordValid) {
        throw new AppError('Old password is incorrect', 400);
    }

    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
        throw new AppError('New password must be different from old password', 400);
    }

    user.password = newPassword;
    await user.save();
};
