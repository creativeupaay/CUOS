import { Request, Response, NextFunction } from 'express';
import { User } from '../../auth/models/User.model';
import { Partner } from '../models/Partner.model';
import AppError from '../../../utils/appError';
import type { IRole } from '../../auth/models/Role.model';
import { Types } from 'mongoose';

/** Extract role name from a populated role field */
function getRoleName(role: unknown): string {
    if (!role || role instanceof Types.ObjectId) return '';
    return ((role as IRole).name || '').toLowerCase();
}

/**
 * Middleware to attach partner information to request for data filtering
 * If user is a partner, adds partnerId to request object
 * If user is an admin, allows seeing all data
 */
export const attachPartnerContext = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const user = await User.findById(req.user.id).populate<{ role: IRole }>('role');

        if (!user) {
            return next(new AppError('User not found', 401));
        }

        const roleName = getRoleName(user.role);

        // If user is partner, find their partner record and attach partnerId
        if (roleName === 'partner') {
            const partner = await Partner.findOne({ userId: user._id });

            if (!partner) {
                return next(new AppError('Partner record not found', 404));
            }

            if (!partner.isActive) {
                return next(new AppError('Partner account is inactive', 403));
            }

            // Attach partner info to request
            req.partnerId = partner._id.toString();
            req.isPartner = true;
        } else if (roleName === 'super-admin' || roleName === 'admin') {
            // Admins can see all data
            req.isPartner = false;
        } else {
            // Regular employees cannot access partner routes
            return next(new AppError('Access denied', 403));
        }

        next();
    } catch (error) {
        return next(new AppError('Failed to determine partner context', 500));
    }
};

/**
 * Middleware to ensure partners only see their own data
 * Adds partnerId filter to query/body based on user role
 * Also supports PartnerEmployee users
 */
export const filterPartnerData = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const user = await User.findById(req.user.id).populate<{ role: IRole }>('role');

        if (!user) {
            // Check if it's a partner employee
            const { PartnerEmployee } = await import('../models/PartnerEmployee.model');
            const partnerEmployee = await PartnerEmployee.findById(req.user.id);

            if (partnerEmployee) {
                // Partner employee - use parent partner's ID
                const partnerId = partnerEmployee.partnerId.toString();

                if (req.method === 'GET') {
                    req.query.partnerId = partnerId;
                }

                if (req.method === 'POST' || req.method === 'PUT') {
                    req.body.partnerId = partnerId;
                }

                req.partnerId = partnerId;
                req.isPartner = true;
                req.isPartnerEmployee = true;

                return next();
            }

            return next(new AppError('User not found', 401));
        }

        const roleName = getRoleName(user.role);

        // If user is a partner, enforce partnerId filtering
        if (roleName === 'partner') {
            const partner = await Partner.findOne({ userId: user._id });

            if (!partner) {
                return next(new AppError('Partner record not found', 404));
            }

            if (!partner.isActive) {
                return next(new AppError('Partner account is inactive', 403));
            }

            // For GET requests (listing), add partnerId to query filter
            if (req.method === 'GET') {
                req.query.partnerId = partner._id.toString();
            }

            // For POST/PUT requests (create/update), ensure partnerId is set
            if (req.method === 'POST' || req.method === 'PUT') {
                req.body.partnerId = partner._id.toString();
            }

            // Store partner ID in request for later use
            req.partnerId = partner._id.toString();
            req.isPartner = true;
            req.isPartnerEmployee = false;
        } else if (roleName === 'super-admin' || roleName === 'admin') {
            // Admins can see/edit all data without filtering
            req.isPartner = false;
            req.isPartnerEmployee = false;
        }

        next();
    } catch (error) {
        return next(new AppError('Failed to apply partner filter', 500));
    }
};

// Extend Express Request type to include partner-related properties
declare global {
    namespace Express {
        interface Request {
            partnerId?: string;
            isPartner?: boolean;
            isPartnerEmployee?: boolean;
            userRole?: string;
        }
    }
}
