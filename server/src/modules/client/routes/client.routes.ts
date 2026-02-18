import { Router } from 'express';
import * as clientController from '../controllers/client.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';
import {
    createClientSchema,
    updateClientSchema,
    getClientSchema,
    listClientsSchema,
} from '../validators/client.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Client CRUD
router.post('/', validateRequest(createClientSchema), clientController.createClient);
router.get('/', validateRequest(listClientsSchema), clientController.getClients);
router.get('/:id', validateRequest(getClientSchema), clientController.getClient);
router.patch('/:id', validateRequest(getClientSchema), validateRequest(updateClientSchema), clientController.updateClient);
router.delete('/:id', validateRequest(getClientSchema), clientController.deleteClient);

// Client projects
router.get('/:id/projects', validateRequest(getClientSchema), clientController.getClientProjects);

export default router;
