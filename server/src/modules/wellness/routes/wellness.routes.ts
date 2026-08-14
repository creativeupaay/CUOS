import { Router } from 'express';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { getHydrationMessage } from '../controllers/hydration.controller';

const router = Router();

/**
 * POST /api/v1/wellness/hydration-message
 * Generate a personalized hydration reminder message (Gemini or fallback).
 * Requires authentication — this is a user-specific wellness endpoint.
 */
router.post('/hydration-message', authenticate, getHydrationMessage);

export default router;
