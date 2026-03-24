import { Request, Response, NextFunction } from 'express';
import { User } from '../../auth/models/User.model';
import AppError from '../../../utils/appError';

/**
 * Middleware to check if the authenticated user is a partner
 */
export const isPartner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const user = await User.findById(req.user.id).populate('role');

        if (!user) {
            return next(new AppError('User not found', 401));
        }

        const role = user.role as any;
        if (role && role.name === 'partner') {
            return next();
        }

        return next(new AppError('Access denied. Partners only.', 403));
    } catch (error) {
        return next(new AppError('Failed to verify partner status', 500));
    }
};

/**
 * Middleware to check if user is partner or admin
 * Used for routes that both partners and admins can access
 */
export const isPartnerOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const user = await User.findById(req.user.id).populate('role');

        if (!user) {
            return next(new AppError('User not found', 401));
        }

        const role = user.role as any;
        const roleName = role?.name?.toLowerCase();

        if (
            roleName === 'partner' ||
            roleName === 'super-admin' ||
            roleName === 'admin'
        ) {
            // Store role in request object for later use
            req.userRole = roleName;
            return next();
        }

        return next(new AppError('Access denied. Partners or admins only.', 403));
    } catch (error) {
        return next(new AppError('Failed to verify user role', 500));
    }
};
