import { Router } from 'express';
import * as partnerAuthController from '../controllers/partnerAuth.controller';
import { validateRequest } from '../../../middlewares/validateRequest';
import {
    submitPartnerRegistrationSchema,
    getPartnerByTokenSchema,
    getPartnerBySlugSchema,
} from '../validators/partner.validator';

const router = Router();

// Public routes - no authentication required

// Get partner info by slug (for personalized login page)
router.get('/login/:slug', validateRequest(getPartnerBySlugSchema), partnerAuthController.getPartnerBySlug);

// Get partner info by registration token (for pre-filling onboarding form)
router.get('/onboarding/:token', validateRequest(getPartnerByTokenSchema), partnerAuthController.getPartnerByToken);

// Submit partner onboarding form (with password)
router.post('/onboarding/:token', validateRequest(submitPartnerRegistrationSchema), partnerAuthController.submitPartnerRegistration);

export default router;
