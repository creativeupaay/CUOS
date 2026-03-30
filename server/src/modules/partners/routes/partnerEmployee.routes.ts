import { Router } from 'express';
import * as partnerEmployeeController from '../controllers/partnerEmployee.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { requirePartnerEmployeeModuleAccess } from '../middlewares/partnerEmployeeModuleAccess.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requirePartnerEmployeeModuleAccess('teamManagement'));

// Partner employee CRUD
router.post('/', partnerEmployeeController.createEmployee);
router.get('/', partnerEmployeeController.getEmployees);
router.get('/stats', partnerEmployeeController.getEmployeeStats);
router.get('/:id', partnerEmployeeController.getEmployeeById);
router.patch('/:id', partnerEmployeeController.updateEmployee);
router.delete('/:id', partnerEmployeeController.deleteEmployee);

// Special actions
router.post('/:id/toggle-status', partnerEmployeeController.toggleEmployeeStatus);
router.post('/:id/reset-password', partnerEmployeeController.resetEmployeePassword);

export default router;
