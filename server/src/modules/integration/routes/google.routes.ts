import { Router } from 'express';
import {
    initiateGoogleOAuth,
    handleGoogleCallback,
    getGoogleStatus,
    disconnectGoogle,
    syncMeetNow,
    getUpcomingMeetings
} from '../controllers/google.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';

const router = Router();

/**
 * GET /api/v1/integrations/google/connect
 * Start Google OAuth flow — redirects to Google consent screen.
 * Requires authentication (user must be logged in first).
 */
router.get('/connect', authenticate, initiateGoogleOAuth);

/**
 * GET /api/v1/integrations/google/callback
 * OAuth callback from Google — exchanges code for tokens.
 * Note: authenticate middleware is applied here too because the CUOS session
 * cookie will be present from the browser redirect.
 */
router.get('/callback', authenticate, handleGoogleCallback);

/**
 * GET /api/v1/integrations/google/status
 * Get the current user's Google integration status (no tokens returned).
 */
router.get('/status', authenticate, getGoogleStatus);

/**
 * DELETE /api/v1/integrations/google/disconnect
 * Revoke Google tokens and remove the integration.
 */
router.delete('/disconnect', authenticate, disconnectGoogle);

/**
 * POST /api/v1/integrations/google/meet/sync
 * Manually trigger a Google Meet sync for the current user.
 */
router.post('/meet/sync', authenticate, syncMeetNow);

/**
 * GET /api/v1/integrations/google/calendar/upcoming
 * Fetch upcoming Google Calendar meetings.
 */
router.get('/calendar/upcoming', authenticate, getUpcomingMeetings);

export default router;
