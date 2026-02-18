import { Request, Response, NextFunction } from 'express';
import { User } from '../../auth/models/User.model';
import AppError from '../../../utils/appError';

/**
 * Feature-level permission check middleware.
 * Checks if the user's role has the required resource:action permission.
 * Super Admin bypasses all checks.
 *
 * Usage: checkPermission('projects', 'create')
 */
export const checkPermission = (resource: string, action: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new AppError('Authentication required', 401));
            }

            // Super Admin bypasses all permission checks
            if (req.user.role === 'super-admin') {
                return next();
            }

            // Fetch user with populated role and permissions
            const user = await User.findById(req.user.id).populate({
                path: 'role',
                populate: { path: 'permissions' },
            });

            if (!user) {
                return next(new AppError('User not found', 401));
            }

            const role = user.role as any;
            if (!role || !role.permissions) {
                return next(new AppError('No permissions assigned', 403));
            }

            // Check if the role has the required permission
            const hasPermission = role.permissions.some(
                (p: any) =>
                    (p.resource === resource && p.action === action) ||
                    (p.resource === resource && p.action === 'manage')
            );

            if (!hasPermission) {
                return next(
                    new AppError(
                        `You do not have permission to ${action} ${resource}`,
                        403
                    )
                );
            }

            next();
        } catch (error) {
            return next(new AppError('Permission check failed', 500));
        }
    };
};
