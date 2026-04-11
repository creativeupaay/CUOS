import { Request, Response, NextFunction, CookieOptions } from 'express';
import * as authService from '../services/auth.service';
import asyncHandler from '../../../utils/asyncHandler';
import { env } from '../../../config/env.config';

const ACCESS_TOKEN_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export const register = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const user = await authService.register(req.body);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: user,
        });
    }
);

export const login = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { user, accessToken, refreshToken } = await authService.login(req.body);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
             secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
            sameSite: env.NODE_ENV === 'production' ? 'strict' : env.NODE_ENV === 'staging' ? 'none' : 'lax',
            path: '/',
            maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
        });

        // Set access token in HTTP-only cookie
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
            sameSite: env.NODE_ENV === 'production' ? 'strict' : env.NODE_ENV === 'staging' ? 'none' : 'lax',
            path: '/',
            maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user,
            },
        });
    }
);

export const partnerLogin = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { slug } = req.params;
        const { user, accessToken, refreshToken } = await authService.partnerLogin(req.body, slug);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
             secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
            sameSite: env.NODE_ENV === 'production' ? 'strict' : env.NODE_ENV === 'staging' ? 'none' : 'lax',
            path: '/',
            maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
        });

        // Set access token in HTTP-only cookie
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
             secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
            sameSite: env.NODE_ENV === 'production' ? 'strict' : env.NODE_ENV === 'staging' ? 'none' : 'lax',
            path: '/',
            maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user,
            },
        });
    }
);

export const refreshToken = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        // Get refresh token from cookie or body
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token not provided',
            });
        }

        const { accessToken } = await authService.refreshAccessToken(refreshToken);

        // Set access token in HTTP-only cookie
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
            sameSite: env.NODE_ENV === 'production' ? 'strict' : env.NODE_ENV === 'staging' ? 'none' : 'lax',
            path: '/',
            maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
        });

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
        });
    }
);



export const logout = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const cookieOptions: CookieOptions = {
            httpOnly: true,
            secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
            sameSite: (env.NODE_ENV === 'production' ? 'strict' : env.NODE_ENV === 'staging' ? 'none' : 'lax') as 'strict' | 'none' | 'lax',
            path: '/',
        };
        res.clearCookie('refreshToken', cookieOptions);
        res.clearCookie('accessToken', cookieOptions);

        res.status(200).json({
            success: true,
            message: 'Logout successful',
        });
    }
);

export const getMe = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        const user = await authService.getCurrentUser(userId);

        res.status(200).json({
            success: true,
            message: 'User retrieved successfully',
            data: user,
        });
    }
);

export const getUsers = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const users = await authService.getAllUsers(req.user as any);

        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            data: { users },
        });
    }
);

export const changePassword = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        const { oldPassword, newPassword } = req.body;
        await authService.changePassword(userId, oldPassword, newPassword);

        return res.status(200).json({
            success: true,
            message: 'Password changed successfully',
        });
    }
);
