import { Request, Response, NextFunction } from 'express';
import AppError from '../../../utils/appError';
import { PartnerEmployee } from '../models/PartnerEmployee.model';

type PartnerEmployeeModuleKey = 'projectManagement' | 'crm' | 'teamManagement';

export const requirePartnerEmployeeModuleAccess = (moduleKey: PartnerEmployeeModuleKey) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new AppError('Authentication required', 401));
            }

            // Restrict only partner employee users. Partner owners/admins follow existing access model.
            if (!req.user.isPartnerEmployee) {
                return next();
            }

            const partnerEmployee = await PartnerEmployee.findById(req.user.id)
                .select('isActive modulePermissions')
                .lean();

            if (!partnerEmployee) {
                return next(new AppError('Partner employee not found', 401));
            }

            if (!partnerEmployee.isActive) {
                return next(new AppError('User account is deactivated', 403));
            }

            if (!partnerEmployee.modulePermissions?.[moduleKey]) {
                return next(new AppError(`Access denied for ${moduleKey} module`, 403));
            }

            return next();
        } catch (error) {
            return next(new AppError('Failed to validate module access', 500));
        }
    };
};
