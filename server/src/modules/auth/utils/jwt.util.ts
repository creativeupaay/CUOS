import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || '';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error('JWT secrets must be defined in environment variables');
}

export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
}

/**
 * Generate access token (short-lived)
 */
export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, ACCESS_SECRET, {
        expiresIn: ACCESS_EXPIRY,
    });
};

/**
 * Generate refresh token (long-lived)
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRY,
    });
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
        throw new Error('Invalid or expired refresh token');
    }
};

/**
 * Decode token without verification (for debugging)
 */
export const decodeToken = (token: string): any => {
    return jwt.decode(token);
};
