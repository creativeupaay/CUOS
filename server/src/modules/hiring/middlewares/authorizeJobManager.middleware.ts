import { Request, Response, NextFunction } from 'express';
import AppError from '../../../utils/appError';
import { JobService } from '../services/job.service';

const jobService = new JobService();

// Roles that always have view access to the hiring module
const VIEW_ROLES = ['super-admin', 'admin', 'hr', 'hr-admin', 'hr-manager', 'manager'];
// Roles that always have manage (create/update/delete) access
const MANAGE_ROLES = ['super-admin', 'admin', 'hr', 'hr-admin', 'hr-manager'];

/**
 * Middleware that allows access if the user has a view role OR is a job manager.
 * Sets `req.isJobManager` flag for downstream use.
 */
export const authorizeHiringView = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return next(new AppError('Authentication required', 401));
    }

    const userRole = req.user.role;

    // Admin/HR roles always have access
    if (VIEW_ROLES.includes(userRole)) {
        (req as any).isJobManager = false;
        (req as any).isHiringAdmin = true;
        return next();
    }

    // Check if user is a job manager
    try {
        const isManager = await jobService.isUserJobManager(req.user.id);
        if (isManager) {
            (req as any).isJobManager = true;
            (req as any).isHiringAdmin = false;
            return next();
        }
    } catch {
        // Fall through to 403
    }

    return next(new AppError('You do not have permission to access the hiring module', 403));
};

/**
 * Middleware that allows manage access if the user has a manage role OR is a job manager.
 */
export const authorizeHiringManage = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return next(new AppError('Authentication required', 401));
    }

    const userRole = req.user.role;

    // Admin/HR roles always have manage access
    if (MANAGE_ROLES.includes(userRole)) {
        (req as any).isJobManager = false;
        (req as any).isHiringAdmin = true;
        return next();
    }

    // Check if user is a job manager
    try {
        const isManager = await jobService.isUserJobManager(req.user.id);
        if (isManager) {
            (req as any).isJobManager = true;
            (req as any).isHiringAdmin = false;
            return next();
        }
    } catch {
        // Fall through to 403
    }

    return next(new AppError('You do not have permission to perform this action', 403));
};

/**
 * Middleware that checks if a user is a manager for a specific job (from req.params.id or req.params.jobId).
 * Must be used AFTER authorizeHiringView or authorizeHiringManage.
 */
export const authorizeJobAccess = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    // If user is a hiring admin (role-based), allow access to all jobs
    if ((req as any).isHiringAdmin) {
        return next();
    }

    // If user is a job manager, verify they manage this specific job
    const jobId = req.params.id || req.params.jobId;
    if (!jobId) {
        return next();
    }

    try {
        const isManager = await jobService.isUserManagerForJob(req.user!.id, jobId);
        if (isManager) {
            return next();
        }
    } catch {
        // Fall through to 403
    }

    return next(new AppError('You do not have permission to access this job', 403));
};
