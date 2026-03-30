import { Request, Response, NextFunction } from 'express';
import { Partner } from '../models/Partner.model';
import { PartnerEmployee } from '../models/PartnerEmployee.model';
import AppError from '../../../utils/appError';

/**
 * Middleware to extract partner context from authenticated user
 * Sets req.partner with partnerId and userId for use in controllers
 */
export const extractPartnerContext = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const userId = req.user.id;

        // First check if it's a partner (main account)
        const partner = await Partner.findOne({ userId }).lean();
        if (partner) {
            (req as any).partner = {
                partnerId: partner._id.toString(),
                userId: userId,
                type: 'partner',
            };
            return next();
        }

        // Check if it's a partner employee
        const partnerEmployee = await PartnerEmployee.findById(userId).lean();
        if (partnerEmployee) {
            (req as any).partner = {
                partnerId: partnerEmployee.partnerId.toString(),
                userId: userId,
                type: 'employee',
                modulePermissions: partnerEmployee.modulePermissions,
            };
            return next();
        }

        return next(new AppError('Partner context not found', 404));
    } catch (error) {
        return next(new AppError('Failed to extract partner context', 500));
    }
};
