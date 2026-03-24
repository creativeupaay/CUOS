import { Router } from 'express';
import * as clientController from '../controllers/client.controller';
import * as onboardingController from '../controllers/clientOnboarding.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { filterPartnerData } from '../../partners/middlewares/filterPartnerData.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';
import {
    createClientSchema,
    updateClientSchema,
    getClientSchema,
    listClientsSchema,
    addClientActivitySchema,
} from '../validators/client.validator';
import AppError from '../../../utils/appError';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(filterPartnerData);

const requireAdmin = (req: any, _res: any, next: any) => {
    const role = req.user?.role?.toLowerCase();
    if (role === 'admin' || role === 'super-admin' || role === 'super_admin') {
        return next();
    }

    return next(new AppError('Access denied. Admins only.', 403));
};

// Client CRUD
router.post('/', validateRequest(createClientSchema), clientController.createClient);
router.get('/', validateRequest(listClientsSchema), clientController.getClients);
router.get('/:id', validateRequest(getClientSchema), clientController.getClient);
router.patch('/:id', validateRequest(getClientSchema), validateRequest(updateClientSchema), clientController.updateClient);
router.delete('/:id', validateRequest(getClientSchema), requireAdmin, clientController.deleteClient);

// Client projects
router.get('/:id/projects', validateRequest(getClientSchema), clientController.getClientProjects);

// Client activities
router.post('/:id/activities', validateRequest(addClientActivitySchema), clientController.addActivity);

// Client onboarding form — (re)send link
router.post('/:id/send-onboarding', validateRequest(getClientSchema), onboardingController.sendOnboardingEmail);

// ─── Client Portal Management ─────────────────────────────────────────────────
// Generate or regenerate the unique portal access link
router.post('/:id/portal/generate-link', validateRequest(getClientSchema), clientController.generatePortalToken);
// Revoke portal access (token cleared, existing link stops working)
router.delete('/:id/portal/revoke', validateRequest(getClientSchema), clientController.revokePortalToken);
router.patch('/:id/portal/toggle', validateRequest(getClientSchema), clientController.togglePortal);

export default router;
