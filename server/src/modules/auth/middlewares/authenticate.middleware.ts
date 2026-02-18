import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import AppError from '../../../utils/appError';
import { User } from '../models/User.model';

/**
 * Authenticate middleware - Verify JWT token
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('No token provided', 401));
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const payload = verifyAccessToken(token);

        // Get user from database
        const user = await User.findById(payload.userId).populate('role');

        if (!user) {
            return next(new AppError('User not found', 401));
        }

        if (!user.isActive) {
            return next(new AppError('User account is deactivated', 403));
        }

        // Attach user to request
        req.user = {
            id: user._id.toString(),
            email: user.email,
            role: (user.role as any).name,
        };

        next();
    } catch (error: any) {
        return next(new AppError(error.message || 'Authentication failed', 401));
    }
};

/**
 * Optional authentication - Don't fail if no token
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const payload = verifyAccessToken(token);

            const user = await User.findById(payload.userId).populate('role');

            if (user && user.isActive) {
                req.user = {
                    id: user._id.toString(),
                    email: user.email,
                    role: (user.role as any).name,
                };
            }
        }

        next();
    } catch (error) {
        // Don't fail, just continue without user
        next();
    }
};
