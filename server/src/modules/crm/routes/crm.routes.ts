import { Router } from 'express';
import multer from 'multer';
import * as leadController from '../controllers/lead.controller';
import * as proposalController from '../controllers/proposal.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { authorize } from '../../auth/middlewares/authorize.middleware';
import { checkLeadAccess, checkProposalAccess } from '../middlewares/crmAccess.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';
import {
    createLeadSchema,
    updateLeadSchema,
    getLeadSchema,
    listLeadsSchema,
    addActivitySchema,
    addMeetingSchema,
} from '../validators/lead.validator';
import {
    createProposalSchema,
    updateProposalSchema,
    getProposalSchema,
    listProposalsSchema,
    updateStatusSchema,
} from '../validators/proposal.validator';

// Import client controller for CRM client routes
import * as clientController from '../../client/controllers/client.controller';
import { listClientsSchema, getClientSchema } from '../../client/validators/client.validator';
import { requirePartnerEmployeeModuleAccess } from '../../partners/middlewares/partnerEmployeeModuleAccess.middleware';
import AppError from '../../../utils/appError';
import { hasModuleAdminAccess, hasModuleViewAccess } from '../../../utils/moduleAccess.util';
import { NextFunction, Request, Response } from 'express';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All CRM routes require authentication
router.use(authenticate);
router.use(requirePartnerEmployeeModuleAccess('crm'));
router.use((req: Request, _res: Response, next: NextFunction) => {
    if (hasModuleViewAccess(req.user, 'crm')) return next();
    return next(new AppError('You do not have permission to access CRM', 403));
});

const crmAdminOnly = (req: Request, _res: Response, next: NextFunction) => {
    if (hasModuleAdminAccess(req.user, 'crm')) return next();
    return next(new AppError('CRM admin access is required', 403));
};

// CRM access: super-admin, admin, manager, employee (with dept=crm)
const crmRoles = ['super-admin', 'admin', 'manager', 'employee', 'partner'];
const crmManagers = ['super-admin', 'admin', 'manager'];

// ============================================
// PIPELINE SUMMARY (before /:id routes)
// ============================================
router.get(
    '/leads/pipeline',
    authorize(crmRoles),
    leadController.getPipelineSummary
);

// ============================================
// LEAD ROUTES
// ============================================
router.post(
    '/leads',
    authorize(crmRoles),
    crmAdminOnly,
    validateRequest(createLeadSchema),
    leadController.createLead
);

router.get(
    '/leads',
    authorize(crmRoles),
    validateRequest(listLeadsSchema),
    leadController.getLeads
);

router.get(
    '/leads/:id',
    authorize(crmRoles),
    validateRequest(getLeadSchema),
    checkLeadAccess,
    leadController.getLead
);

router.patch(
    '/leads/:id',
    authorize(crmRoles),
    crmAdminOnly,
    validateRequest(getLeadSchema),
    validateRequest(updateLeadSchema),
    checkLeadAccess,
    leadController.updateLead
);

router.delete(
    '/leads/:id',
    authorize(crmManagers),
    crmAdminOnly,
    validateRequest(getLeadSchema),
    leadController.deleteLead
);

router.post(
    '/leads/:id/activities',
    authorize(crmRoles),
    crmAdminOnly,
    validateRequest(getLeadSchema),
    validateRequest(addActivitySchema),
    checkLeadAccess,
    leadController.addActivity
);

router.post(
    '/leads/:id/meetings',
    authorize(crmRoles),
    crmAdminOnly,
    validateRequest(getLeadSchema),
    validateRequest(addMeetingSchema),
    checkLeadAccess,
    leadController.addMeeting
);

router.post(
    '/leads/:id/documents/upload',
    authorize(crmRoles),
    crmAdminOnly,
    validateRequest(getLeadSchema),
    checkLeadAccess,
    upload.any(),
    leadController.uploadLeadDocument
);

router.post(
    '/leads/:id/close',
    authorize(crmRoles),
    crmAdminOnly,
    validateRequest(getLeadSchema),
    checkLeadAccess,
    leadController.closeLead
);

// ============================================
// PROPOSAL ROUTES
// ============================================
router.post(
    '/proposals',
    authorize(crmRoles),
    crmAdminOnly,
    validateRequest(createProposalSchema),
    proposalController.createProposal
);

router.get(
    '/proposals',
    authorize(crmRoles),
    validateRequest(listProposalsSchema),
    proposalController.getProposals
);

router.get(
    '/proposals/:id',
    authorize(crmRoles),
    validateRequest(getProposalSchema),
    checkProposalAccess,
    proposalController.getProposal
);

router.patch(
    '/proposals/:id',
    authorize(crmRoles),
    crmAdminOnly,
    validateRequest(getProposalSchema),
    validateRequest(updateProposalSchema),
    checkProposalAccess,
    proposalController.updateProposal
);

router.delete(
    '/proposals/:id',
    authorize(crmManagers),
    crmAdminOnly,
    validateRequest(getProposalSchema),
    proposalController.deleteProposal
);

router.patch(
    '/proposals/:id/status',
    authorize(crmRoles),
    crmAdminOnly,
    validateRequest(getProposalSchema),
    validateRequest(updateStatusSchema),
    checkProposalAccess,
    proposalController.updateStatus
);

// ============================================
// CRM CLIENT ROUTES (proxy to client module)
// ============================================
router.get(
    '/clients',
    authorize(crmRoles),
    validateRequest(listClientsSchema),
    clientController.getClients
);

router.get(
    '/clients/:id',
    authorize(crmRoles),
    validateRequest(getClientSchema),
    clientController.getClient
);

router.get(
    '/clients/:id/projects',
    authorize(crmRoles),
    validateRequest(getClientSchema),
    clientController.getClientProjects
);

export default router;
