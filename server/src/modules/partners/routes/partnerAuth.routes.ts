import { Router } from 'express';
import * as partnerAuthController from '../controllers/partnerAuth.controller';
import { validateRequest } from '../../../middlewares/validateRequest';
import {
    submitPartnerRegistrationSchema,
    getPartnerByTokenSchema,
} from '../validators/partner.validator';

const router = Router();

// Public routes - no authentication required

// Get partner info by registration token (for pre-filling form)
router.get('/:token', validateRequest(getPartnerByTokenSchema), partnerAuthController.getPartnerByToken);

// Submit partner registration form
router.post('/:token', validateRequest(submitPartnerRegistrationSchema), partnerAuthController.submitPartnerRegistration);

export default router;
