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
 * Login user
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

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Get role name (role may be null if the role document was deleted)
    const role = user.role as any;
    if (!role) {
        throw new AppError('User role not found. Please contact an administrator.', 500);
    }
    const roleName = role.name || 'employee';

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
