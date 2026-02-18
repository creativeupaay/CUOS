import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import AppError from '../../../utils/appError';
import { User } from '../models/User.model';

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
        const user = await User.findById(payload.userId).populate('role');

        if (!user) {
            return next(new AppError('User not found', 401));
        }

        if (!user.isActive) {
            return next(new AppError('User account is deactivated', 403));
        }

        // 5. Attach user to request
        (req as any).user = {
            id: (user._id as any).toString(),
            email: user.email,
            role: (user.role as any).name,
        };

        next();
    } catch (error: any) {
        return next(new AppError('Invalid or expired token', 401));
    }
};
