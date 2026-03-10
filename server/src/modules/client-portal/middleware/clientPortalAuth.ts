import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.config';

export interface ClientPortalRequest extends Request {
    portalClient?: {
        clientId: string;
        email: string;
        name: string;
    };
}

export const clientPortalAuth = (
    req: ClientPortalRequest,
    res: Response,
    next: NextFunction
): void => {
    const cookieToken = (req as any).cookies?.portal_jwt as string | undefined;
    if (!cookieToken) {
        res.status(401).json({ status: 'fail', message: 'Not authenticated. Please use your portal access link.' });
        return;
    }
    try {
        const decoded = jwt.verify(cookieToken, env.JWT_ACCESS_SECRET) as any;
        if (decoded.type !== 'client-portal') {
            res.status(401).json({ status: 'fail', message: 'Invalid token type.' });
            return;
        }
        req.portalClient = {
            clientId: decoded.clientId,
            email: decoded.email,
            name: decoded.name,
        };
        next();
    } catch {
        res.status(401).json({ status: 'fail', message: 'Session expired. Please use your portal access link again.' });
    }
};
