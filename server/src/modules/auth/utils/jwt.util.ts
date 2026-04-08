import jwt from 'jsonwebtoken';
import {env} from '../../../config/env.config';


const ACCESS_SECRET = env.JWT_ACCESS_SECRET || '';
const REFRESH_SECRET = env.JWT_REFRESH_SECRET || '';
const ACCESS_EXPIRY = env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = env.JWT_REFRESH_EXPIRY || '7d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error('JWT secrets must be defined in environment variables');
}

export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
}

const stripReservedJwtClaims = (payload: Record<string, unknown>): Record<string, unknown> => {
    const { exp, iat, nbf, jti, ...safePayload } = payload;
    return safePayload;
};

/**
 * Generate access token (short-lived)
 */
export const generateAccessToken = (payload: TokenPayload): string => {
    const safePayload = stripReservedJwtClaims({ ...payload });
    return jwt.sign(safePayload, ACCESS_SECRET as any, {
        expiresIn: ACCESS_EXPIRY,
    } as any);
};

/**
 * Generate refresh token (long-lived)
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
    const safePayload = stripReservedJwtClaims({ ...payload });
    return jwt.sign(safePayload, REFRESH_SECRET as any, {
        expiresIn: REFRESH_EXPIRY,
    } as any);
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
    try {
        return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
    } catch (error) {
        throw new Error('Invalid or expired access token');
    }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
    try {
        return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
    } catch (error) {
        console.log('Refresh token verification failed:', error);
        throw new Error('Invalid or expired refresh token');
    }
};

/**
 * Decode token without verification (for debugging)
 */
export const decodeToken = (token: string): any => {
    return jwt.decode(token);
};
