import { Router } from 'express';
import * as partnerController from '../controllers/partner.controller';
import * as partnerAuthController from '../controllers/partnerAuth.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { checkPermission } from '../../overall-admin/middlewares/checkPermission.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';
import {
    createPartnerSchema,
    updatePartnerSchema,
    getPartnerSchema,
    listPartnersSchema,
} from '../validators/partner.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All partner management routes require admin permission (users.manage covers partner management)
router.use(checkPermission('users', 'manage'));

// Partner CRUD
router.post('/', validateRequest(createPartnerSchema), partnerController.createPartner);
router.get('/', validateRequest(listPartnersSchema), partnerController.getAllPartners);
router.get('/:id', validateRequest(getPartnerSchema), partnerController.getPartnerById);
router.patch('/:id', validateRequest(getPartnerSchema), validateRequest(updatePartnerSchema), partnerController.updatePartner);
router.delete('/:id', validateRequest(getPartnerSchema), partnerController.deletePartner);

// Partner activation/deactivation
router.patch('/:id/deactivate', validateRequest(getPartnerSchema), partnerController.deactivatePartner);
router.patch('/:id/activate', validateRequest(getPartnerSchema), partnerController.activatePartner);

// Partner statistics
router.get('/:id/stats', validateRequest(getPartnerSchema), partnerController.getPartnerStats);
router.get('/:id/clients', validateRequest(getPartnerSchema), partnerController.getPartnerClients);
router.get('/:id/projects', validateRequest(getPartnerSchema), partnerController.getPartnerProjects);

// Regenerate registration token
router.post('/:id/regenerate-token', validateRequest(getPartnerSchema), partnerAuthController.regenerateRegistrationToken);

export default router;
