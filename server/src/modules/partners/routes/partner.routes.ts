import { Router } from 'express';
import multer from 'multer';
import * as partnerController from '../controllers/partner.controller';
import * as partnerAuthController from '../controllers/partnerAuth.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { checkPermission } from '../../overall-admin/middlewares/checkPermission.middleware';
import { checkPartnerSelfOrAdmin } from '../middlewares/checkPartnerSelfOrAdmin.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';
import {
    createPartnerSchema,
    updatePartnerSchema,
    getPartnerSchema,
    listPartnersSchema,
} from '../validators/partner.validator';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authenticate);

// We define admin permission middleware separately to reuse on specific routes
const adminOnly = checkPermission('users', 'manage');

// Partner CRUD
router.post('/', adminOnly, validateRequest(createPartnerSchema), partnerController.createPartner);
router.get('/', adminOnly, validateRequest(listPartnersSchema), partnerController.getAllPartners);

// Self OR Admin allows Partner Admin to read/update their own profile
router.get('/:id', validateRequest(getPartnerSchema), checkPartnerSelfOrAdmin, partnerController.getPartnerById);
router.patch('/:id', validateRequest(getPartnerSchema), checkPartnerSelfOrAdmin, validateRequest(updatePartnerSchema), partnerController.updatePartner);
router.patch('/:id/image/:type', validateRequest(getPartnerSchema), checkPartnerSelfOrAdmin, upload.single('file'), partnerController.uploadPartnerImage);
router.delete('/:id', adminOnly, validateRequest(getPartnerSchema), partnerController.deletePartner);

// Partner activation/deactivation
router.patch('/:id/deactivate', adminOnly, validateRequest(getPartnerSchema), partnerController.deactivatePartner);
router.patch('/:id/activate', adminOnly, validateRequest(getPartnerSchema), partnerController.activatePartner);

// Partner statistics
router.get('/:id/stats', validateRequest(getPartnerSchema), checkPartnerSelfOrAdmin, partnerController.getPartnerStats);
router.get('/:id/clients', validateRequest(getPartnerSchema), checkPartnerSelfOrAdmin, partnerController.getPartnerClients);
router.get('/:id/projects', validateRequest(getPartnerSchema), checkPartnerSelfOrAdmin, partnerController.getPartnerProjects);

// Regenerate registration token
router.post('/:id/regenerate-token', adminOnly, validateRequest(getPartnerSchema), partnerAuthController.regenerateRegistrationToken);

export default router;
