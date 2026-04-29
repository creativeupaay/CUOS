import { Request, Response, NextFunction } from 'express';
import { User } from '../../auth/models/User.model';
import AppError from '../../../utils/appError';
import { hasModuleAdminAccess, hasModuleViewAccess } from '../../../utils/moduleAccess.util';

export const checkPartnerSelfOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const userObj = req.user as any;
        const requestedPartnerId = req.params.id;

        if (!requestedPartnerId) {
            return next(new AppError('Partner ID is required', 400));
        }

        // 1. Super Admin checking
        if (userObj.role === 'super-admin') {
            return next();
        }

        // 2. Internal user with partner module access
        if (userObj.role !== 'partner') {
            if (req.method === 'GET' && hasModuleViewAccess(userObj, 'partners')) {
                return next();
            }
            if (hasModuleAdminAccess(userObj, 'partners')) {
                return next();
            }

            const user = await User.findById(userObj.id).populate({
                path: 'role',
                populate: { path: 'permissions' },
            });
            const role = user?.role as any;
            const hasManageUsers = role?.permissions?.some(
                (p: any) => (p.resource === 'users' && p.action === 'manage') || 
                            (p.resource === 'partners' && p.action === 'manage')
            );
            if (hasManageUsers) {
                return next();
            }
        }

        // 3. Partner Admin
        if (userObj.role === 'partner' && !userObj.isPartnerEmployee) {
            const { Partner } = await import('../../partners/models/Partner.model');
            const partnerPortal = await Partner.findOne({ userId: userObj.id }).lean();
            
            if (partnerPortal && partnerPortal._id.toString() === requestedPartnerId) {
                return next();
            }
        }

        // 4. Partner Employee checking their overarching partner details
        if (userObj.role === 'partner' && userObj.isPartnerEmployee) {
            const { PartnerEmployee } = await import('../../partners/models/PartnerEmployee.model');
            const partnerEmployee = await PartnerEmployee.findById(userObj.id).lean();
            
            if (partnerEmployee && partnerEmployee.partnerId.toString() === requestedPartnerId) {
                // Allow read access, but deny write/PATCH access
                if (req.method === 'GET') {
                    return next();
                } else {
                    return next(new AppError('You do not have permission to modify partner metadata', 403));
                }
            }
        }

        return next(new AppError('You do not have permission to access these partner details', 403));
    } catch (error) {
        return next(new AppError('Permission check failed in partner auth', 500));
    }
};
