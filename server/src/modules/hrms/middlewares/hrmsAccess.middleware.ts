import { Request, Response, NextFunction } from 'express';
import AppError from '../../../utils/appError';
import { Employee } from '../models/Employee.model';

/**
 * HRMS access middleware.
 * - super-admin, admin, hr → can access everything
 * - manager → can access team data
 * - employee → can access own data only
 */
export const checkHrmsAccess = (allowSelf = false) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new AppError('Authentication required', 401));
            }

            const { role } = req.user;

            // Full access roles
            if (['super-admin', 'admin', 'hr'].includes(role)) {
                return next();
            }

            // Manager access — can access team members
            if (role === 'manager') {
                const { id } = req.params;
                if (!id) return next();

                const userId = req.user.id;
                const managerEmployee = await Employee.findOne({ userId });

                if (managerEmployee) {
                    const targetEmployee = await Employee.findById(id);
                    if (targetEmployee && targetEmployee.reportingTo?.toString() === managerEmployee._id.toString()) {
                        return next();
                    }
                }
            }

            // Self-access — employee can access their own data
            if (allowSelf) {
                const { id } = req.params;
                if (id) {
                    const employee = await Employee.findById(id);
                    if (employee && employee.userId.toString() === req.user.id) {
                        return next();
                    }
                }
            }

            return next(
                new AppError('You do not have permission to access this resource', 403)
            );
        } catch (error: any) {
            return next(new AppError(error.message || 'Access check failed', 500));
        }
    };
};

/**
 * Restrict to HR and admin roles only.
 */
export const hrAdminOnly = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Authentication required', 401));
    }

    const { role } = req.user;
    if (['super-admin', 'admin', 'hr'].includes(role)) {
        return next();
    }

    return next(new AppError('Access restricted to HR and admin roles', 403));
};
