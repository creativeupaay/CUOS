import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import asyncHandler from '../../../utils/asyncHandler';

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
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user,
                accessToken,
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

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: { accessToken },
        });
    }
);

export const logout = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        // Clear refresh token cookie
        res.clearCookie('refreshToken');

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
