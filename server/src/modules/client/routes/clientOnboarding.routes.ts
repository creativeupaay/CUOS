import { Router } from 'express';
import * as onboardingController from '../controllers/clientOnboarding.controller';

const router = Router();

// ============================================================
// Public routes — NO authentication required
// Mounted at /api/v1/client-onboarding
// ============================================================

/**
 * GET /client-onboarding/:token
 * Returns the client's pre-filled form data for the public onboarding page.
 */
router.get('/:token', onboardingController.getOnboardingForm);

/**
 * POST /client-onboarding/:token/submit
 * Accepts the completed form data and updates the client record.
 */
router.post('/:token/submit', onboardingController.submitOnboardingForm);

export default router;
