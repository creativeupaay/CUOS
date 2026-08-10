import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import AppError from '../../../utils/appError';
import { User, IModulePermissions } from '../models/User.model';
import type { IRole } from '../models/Role.model';
import type { AuthenticatedUser } from '../../../types/express.d';

/**
 * Authenticate middleware - Verify JWT token from Cookie or Header
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        let token;

        // 1. Check for token in cookies (Preferred)
        if (req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }
        // 2. Fallback to Authorization header
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(new AppError('Authentication required. Please log in.', 401));
        }

        // 3. Verify token
        const payload = verifyAccessToken(token);

        // 4. Get user from database
        const user = await User.findById(payload.userId).populate<{ role: IRole }>('role');

        if (user) {
            if (!user.isActive) {
                return next(new AppError('User account is deactivated', 403));
            }

            let partnerId: string | undefined;
            if (user.role.name === 'partner') {
                const { Partner } = await import('../../partners/models/Partner.model');
                const partner = await Partner.findOne({ userId: user._id }).select('_id').lean();
                if (partner?._id) {
                    partnerId = partner._id.toString();
                }
            }

            const authUser: AuthenticatedUser = {
                id: (user._id as unknown as { toString(): string }).toString(),
                name: user.name,
                email: user.email,
                role: user.role.name,
                modulePermissions: user.modulePermissions,
                ...(partnerId ? { partnerId } : {}),
            };

            req.user = authUser;
            return next();
        }

        // Partner employees authenticate against their own collection, not User.
        const { PartnerEmployee } = await import('../../partners/models/PartnerEmployee.model');
        const partnerEmployee = await PartnerEmployee.findById(payload.userId);

        if (!partnerEmployee) {
            return next(new AppError('User not found', 401));
        }

        if (!partnerEmployee.isActive) {
            return next(new AppError('User account is deactivated', 403));
        }

        req.user = {
            id: (partnerEmployee._id as unknown as { toString(): string }).toString(),
            name: partnerEmployee.name,
            email: partnerEmployee.email,
            role: 'partner',
            isPartnerEmployee: true,
            partnerId: partnerEmployee.partnerId?.toString(),
            modulePermissions: {
                projectManagement: { enabled: partnerEmployee.modulePermissions?.projectManagement ?? true, projectPermissions: [] },
                crm: { enabled: partnerEmployee.modulePermissions?.crm ?? false, subModules: { pipeline: false, leads: false, proposals: false, clients: false } },
            } as Partial<IModulePermissions>,
        };

        next();
    } catch (error: unknown) {
        return next(new AppError('Invalid or expired token', 401));
    }
};
