/**
 * google.controller.ts
 *
 * HTTP handlers for the Google OAuth integration endpoints.
 *
 * Security:
 * - Tokens are never returned in any response
 * - State parameter prevents CSRF attacks during OAuth flow
 * - All sensitive operations happen server-side only
 */

import { Request, Response, NextFunction } from 'express';
import {
    getAuthUrl,
    exchangeCodeForTokens,
    upsertGoogleIntegration,
    revokeAndDeleteIntegration,
    getIntegrationStatus,
} from '../services/google.oauth.service';
import { env } from '../../../config/env.config';
import AppError from '../../../utils/appError';
import { logger } from '../../../utils/logger';
import crypto from 'crypto';
import { GoogleIntegration } from '../models/GoogleIntegration.model';
import { syncUserMeetings } from '../jobs/googleMeetSync.job';
import { getValidAccessToken } from '../services/google.oauth.service';
import { fetchCalendarEventsWithMeet } from '../services/google.calendar.service';

// ─── Connect (redirect to Google consent) ────────────────────────────────────

/**
 * GET /api/v1/integrations/google/connect
 * Redirects the authenticated user to Google's OAuth consent screen.
 * A random CSRF state value is stored in a short-lived cookie.
 */
export const initiateGoogleOAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
            return next(new AppError('Google OAuth is not configured on this server.', 503));
        }

        // Generate a random CSRF state value
        const state = crypto.randomBytes(16).toString('hex');

        // Store state in a short-lived httpOnly cookie (5 min)
        res.cookie('google_oauth_state', state, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            maxAge: 5 * 60 * 1000,
            sameSite: 'lax',
        });

        const url = getAuthUrl(state);
        res.redirect(url);
    } catch (err) {
        next(err);
    }
};

// ─── OAuth Callback ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/integrations/google/callback
 * Handles the OAuth redirect from Google. Exchanges the code for tokens,
 * stores them encrypted, and redirects to the frontend settings page.
 */
export const handleGoogleCallback = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { code, state, error } = req.query as Record<string, string>;

        // Handle user-denied consent
        if (error || !code) {
            logger.warn({ error, userId: req.user?.id }, '[Google OAuth] User denied consent or error returned');
            return res.redirect(`${env.FRONTEND_URL}/my-hrms/profile?google=denied`) as any;
        }

        // CSRF state validation
        const storedState = req.cookies?.google_oauth_state;
        if (!storedState || storedState !== state) {
            logger.warn({ userId: req.user?.id }, '[Google OAuth] CSRF state mismatch');
            return res.redirect(`${env.FRONTEND_URL}/my-hrms/profile?google=error&reason=csrf`) as any;
        }

        // Clear state cookie
        res.clearCookie('google_oauth_state');

        if (!req.user?.id) {
            return next(new AppError('Authentication required', 401));
        }

        // Exchange auth code for tokens
        const tokenInfo = await exchangeCodeForTokens(code);

        // Store encrypted integration
        await upsertGoogleIntegration(req.user.id, tokenInfo);

        logger.info({ userId: req.user.id, googleEmail: tokenInfo.googleEmail }, '[Google OAuth] Integration connected');

        // Redirect to frontend settings page with success indicator
        res.redirect(`${env.FRONTEND_URL}/my-hrms/profile?google=connected`);
    } catch (err) {
        logger.error({ err }, '[Google OAuth] Callback error');
        res.redirect(`${env.FRONTEND_URL}/my-hrms/profile?google=error`);
    }
};

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/integrations/google/status
 * Returns the connection status for the current user.
 * NEVER returns tokens.
 */
export const getGoogleStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) return next(new AppError('Authentication required', 401));

        const status = await getIntegrationStatus(req.user.id);
        res.status(200).json({
            status: 'success',
            data: status,
        });
    } catch (err) {
        next(err);
    }
};

// ─── Disconnect ───────────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/integrations/google/disconnect
 * Revokes the Google token and removes the integration.
 */
export const disconnectGoogle = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) return next(new AppError('Authentication required', 401));

        await revokeAndDeleteIntegration(req.user.id);

        res.status(200).json({
            status: 'success',
            message: 'Google account disconnected successfully.',
        });
    } catch (err) {
        next(err);
    }
};

// ─── Manual Sync ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/integrations/google/meet/sync
 * Manually trigger the Google Meet sync for the current user.
 */
export const syncMeetNow = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) return next(new AppError('Authentication required', 401));

        const integration = await GoogleIntegration.findOne({ 
            userId: req.user.id, 
            status: 'active' 
        }).select('+accessToken +refreshToken').lean<any>();

        if (!integration) {
            return next(new AppError('No active Google integration found.', 404));
        }

        // Run sync synchronously so frontend can wait and reload
        await syncUserMeetings(integration);

        res.status(200).json({
            status: 'success',
            message: 'Meetings synced successfully',
        });
    } catch (err) {
        next(err);
    }
};

// ─── Upcoming Meetings ────────────────────────────────────────────────────────

/**
 * GET /api/v1/integrations/google/calendar/upcoming
 * Fetches upcoming Google Calendar meetings with Meet links.
 */
export const getUpcomingMeetings = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) return next(new AppError('Authentication required', 401));

        const integration = await GoogleIntegration.findOne({ 
            userId: req.user.id, 
            status: 'active' 
        }).select('+accessToken +refreshToken').lean<any>();

        if (!integration) {
            return next(new AppError('No active Google integration found.', 404));
        }

        const accessToken = await getValidAccessToken(integration);

        const timeMin = new Date();
        const timeMax = new Date(timeMin.getTime() + 7 * 24 * 60 * 60 * 1000); // next 7 days

        const events = await fetchCalendarEventsWithMeet(accessToken, timeMin, timeMax);

        res.status(200).json({
            status: 'success',
            data: events,
        });
    } catch (err) {
        next(err);
    }
};

