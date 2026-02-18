import { Router } from 'express';
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
} from '../validators/lead.validator';
import {
    createProposalSchema,
    updateProposalSchema,
    getProposalSchema,
    listProposalsSchema,
    updateStatusSchema,
} from '../validators/proposal.validator';

const router = Router();

// All CRM routes require authentication
router.use(authenticate);

// CRM access: super-admin, admin, manager, employee (with dept=crm)
const crmRoles = ['super-admin', 'admin', 'manager', 'employee'];
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
    validateRequest(getLeadSchema),
    validateRequest(updateLeadSchema),
    checkLeadAccess,
    leadController.updateLead
);

router.delete(
    '/leads/:id',
    authorize(crmManagers),
    validateRequest(getLeadSchema),
    leadController.deleteLead
);

router.post(
    '/leads/:id/activities',
    authorize(crmRoles),
    validateRequest(getLeadSchema),
    validateRequest(addActivitySchema),
    checkLeadAccess,
    leadController.addActivity
);

router.post(
    '/leads/:id/convert',
    authorize(crmRoles),
    validateRequest(getLeadSchema),
    checkLeadAccess,
    leadController.convertToClient
);

// ============================================
// PROPOSAL ROUTES
// ============================================
router.post(
    '/proposals',
    authorize(crmRoles),
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
    validateRequest(getProposalSchema),
    validateRequest(updateProposalSchema),
    checkProposalAccess,
    proposalController.updateProposal
);

router.delete(
    '/proposals/:id',
    authorize(crmManagers),
    validateRequest(getProposalSchema),
    proposalController.deleteProposal
);

router.patch(
    '/proposals/:id/status',
    authorize(crmRoles),
    validateRequest(getProposalSchema),
    validateRequest(updateStatusSchema),
    checkProposalAccess,
    proposalController.updateStatus
);

export default router;
