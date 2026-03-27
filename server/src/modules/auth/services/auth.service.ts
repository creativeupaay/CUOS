import { User, IUser } from '../models/User.model';
import { Role } from '../models/Role.model';
import AppError from '../../../utils/appError';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    TokenPayload,
} from '../utils/jwt.util';

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
    const user = await User.create({
        name: data.name,
        email: data.email,
        password: data.password,
        role: role._id,
        department: data.department,
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
        .populate('role');

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
    const role = user.role as any;
    if (!role) {
        throw new AppError('User role not found. Please contact an administrator.', 500);
    }
    const roleName = role.name?.toLowerCase() || 'employee';

    // BLOCK PARTNERS from using regular login
    if (roleName === 'partner') {
        throw new AppError('Partners must use the partner login portal', 403);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const tokenPayload: TokenPayload = {
        userId: (user._id as any).toString(),
        email: user.email,
        role: roleName,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Remove password from response
    const userObj = user.toObject();
    delete (userObj as any).password;

    return {
        user: userObj as IUser,
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
    let user = await User.findOne({ email: data.email })
        .select('+password')
        .populate('role');

    let isPartnerEmployee = false;
    let partnerIdForEmployee: string | null = null;
    let belongsToThisPortal = false;

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
        const role = user.role as any;
        if (!role) {
            throw new AppError('User role not found. Please contact an administrator.', 500);
        }
        const roleName = role.name?.toLowerCase() || 'employee';

        // ONLY ALLOW PARTNERS to use partner login
        if (roleName !== 'partner') {
            throw new AppError('This login portal is only for partners', 403);
        }

        // Validate this user belongs to the partner portal they're trying to access
        const portalUserId = partnerPortal.userId
            ? typeof partnerPortal.userId === 'object' && '_id' in partnerPortal.userId
                ? (partnerPortal.userId as any)._id.toString()
                : (partnerPortal.userId as any).toString()
            : null;

        belongsToThisPortal = portalUserId === (user._id as any).toString();
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
        const employeePartnerId = partnerEmployee.partnerId
            ? typeof partnerEmployee.partnerId === 'object' && '_id' in partnerEmployee.partnerId
                ? (partnerEmployee.partnerId as any)._id.toString()
                : (partnerEmployee.partnerId as any).toString()
            : null;

        belongsToThisPortal = employeePartnerId === partnerPortal._id.toString();

        // Mark as partner employee and store parent partnerId
        isPartnerEmployee = true;
        partnerIdForEmployee = (partnerEmployee.partnerId as any).toString();

        // Create a user-like object for partner employee
        user = {
            _id: partnerEmployee._id,
            email: partnerEmployee.email,
            name: partnerEmployee.name,
            role: 'partner' as any, // Treat partner employees as partners for access control
            isActive: partnerEmployee.isActive,
            partnerId: partnerEmployee.partnerId,
            isPartnerEmployee: true,
            save: async function() { return this; },
            toObject: function() {
                return {
                    _id: this._id,
                    email: this.email,
                    name: this.name,
                    role: 'partner',
                    isActive: this.isActive,
                    partnerId: this.partnerId,
                    isPartnerEmployee: true,
                };
            },
        } as any;
    }

    // Check if user belongs to this partner portal
    if (!belongsToThisPortal) {
        throw new AppError('You are not authorized to use this login portal. Please use your own partner portal.', 403);
    }

    // Update last login (only for regular partner users, not employees)
    if (!isPartnerEmployee && user?.save) {
        (user as any).lastLogin = new Date();
        await user.save();
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
        userId: user ? (user._id as any).toString() : '',
        email: user?.email || '',
        role: 'partner', // Always 'partner' for access control
    };

    // Add partnerId for partner employees
    if (isPartnerEmployee && partnerIdForEmployee) {
        (tokenPayload as any).partnerIdOverride = partnerIdForEmployee;
    }

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Remove password from response
    const userObj = user?.toObject ? user.toObject() : (user || {});
    delete (userObj as any).password;

    // Add partner info to response
    (userObj as any).partnerSlug = partnerPortal.slug;
    (userObj as any).companyName = partnerPortal.companyName;
    (userObj as any).companyLogo = partnerPortal.companyLogo;

    // Add partnerId to response for partner employees
    if (isPartnerEmployee) {
        (userObj as any).partnerId = partnerIdForEmployee;
        (userObj as any).isPartnerEmployee = true;
    }

    return {
        user: userObj as IUser,
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
    const user = await User.findById(userId).populate({
        path: 'role',
        populate: {
            path: 'permissions',
        },
    });

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const roleName = ((user.role as any)?.name || '').toLowerCase();

    if (roleName === 'partner') {
        const { Partner } = await import('../../partners/models/Partner.model');
        const partnerPortal = await Partner.findOne({ userId: user._id })
            .select('slug companyName companyLogo')
            .lean();

        if (partnerPortal) {
            const userObj = user.toObject() as IUser & {
                partnerSlug?: string;
                companyName?: string;
                companyLogo?: string;
            };

            userObj.partnerSlug = partnerPortal.slug;
            userObj.companyName = partnerPortal.companyName;
            userObj.companyLogo = partnerPortal.companyLogo;

            return userObj as IUser;
        }
    }

    return user;
};

/**
 * Get all users
 */
export const getAllUsers = async (): Promise<IUser[]> => {
    const users = await User.find()
        .select('name email role department isActive')
        .populate('role', 'name');
    return users;
};

/**
 * Change current user's password
 */
export const changePassword = async (
    userId: string,
    oldPassword: string,
    newPassword: string
): Promise<void> => {
    const user = await User.findById(userId).select('+password');

    if (!user) {
        throw new AppError('User not found', 404);
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
