import { Request, Response, NextFunction } from 'express';
import AppError from '../../../utils/appError';
import { Lead } from '../models/Lead.model';
import { Proposal } from '../models/Proposal.model';

/**
 * CRM ownership middleware.
 * Managers, admins, and super-admins bypass ownership checks.
 * CRM employees can only access leads/proposals assigned to them or created by them.
 */
export const checkLeadAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const { role } = req.user;

        // Managers and admins can access all leads
        if (['super-admin', 'admin', 'manager'].includes(role)) {
            return next();
        }

        const { id } = req.params;
        if (!id) return next();

        const lead = await Lead.findById(id);
        if (!lead) {
            return next(new AppError('Lead not found', 404));
        }

        const userId = req.user.id;

        // CRM employees can access if they are assigned or the creator
        if (
            lead.assignedTo?.toString() === userId ||
            lead.createdBy.toString() === userId
        ) {
            return next();
        }

        return next(
            new AppError('You do not have permission to access this lead', 403)
        );
    } catch (error: any) {
        return next(new AppError(error.message || 'Access check failed', 500));
    }
};

/**
 * Proposal access — check via the lead's assignedTo/createdBy
 */
export const checkProposalAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const { role } = req.user;

        if (['super-admin', 'admin', 'manager'].includes(role)) {
            return next();
        }

        const { id } = req.params;
        if (!id) return next();

        const proposal = await Proposal.findById(id);
        if (!proposal) {
            return next(new AppError('Proposal not found', 404));
        }

        const lead = await Lead.findById(proposal.leadId);
        if (!lead) {
            return next(new AppError('Associated lead not found', 404));
        }

        const userId = req.user.id;

        if (
            lead.assignedTo?.toString() === userId ||
            lead.createdBy.toString() === userId ||
            proposal.createdBy.toString() === userId
        ) {
            return next();
        }

        return next(
            new AppError('You do not have permission to access this proposal', 403)
        );
    } catch (error: any) {
        return next(new AppError(error.message || 'Access check failed', 500));
    }
};
