import { Request, Response, NextFunction } from 'express';
import AppError from '../../../utils/appError';

/**
 * Authorize middleware - Check if user has required role
 */
export const authorize = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const userRole = req.user.role;

        if (!allowedRoles.includes(userRole)) {
            return next(
                new AppError('You do not have permission to perform this action', 403)
            );
        }

        next();
    };
};

/**
 * Check if user is super admin
 */
export const isSuperAdmin = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return next(new AppError('Authentication required', 401));
    }

    if (req.user.role !== 'super-admin') {
        return next(new AppError('Super admin access required', 403));
    }

    next();
};

/**
 * Check if user is admin or super admin
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Authentication required', 401));
    }

    if (req.user.role !== 'super-admin' && req.user.role !== 'admin') {
        return next(new AppError('Admin access required', 403));
    }

    next();
};
