import { Router } from 'express';
import multer from 'multer';
import * as jobController from '../controllers/job.controller';
import * as applicationController from '../controllers/application.controller';
import * as assignmentController from '../controllers/assignment.controller';
import * as interviewController from '../controllers/interview.controller';
import * as reportController from '../controllers/report.controller';
import * as jobTemplateController from '../controllers/jobTemplate.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { authorize } from '../../auth/middlewares/authorize.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';
import {
    createJobSchema,
    updateJobSchema,
    getJobSchema,
    listJobsSchema,
    createJobTemplateSchema,
    updateJobTemplateSchema,
    getJobTemplateSchema,
} from '../validators/job.validator';
import {
    applicationDecisionSchema,
    createPublicApplicationSchema,
    getApplicationSchema,
    listApplicationsSchema,
    updateApplicationSchema,
    updateStatusSchema,
    tagSchema,
} from '../validators/application.validator';
import {
    assignmentIdParamSchema,
    createAssignmentSchema,
    getAssignmentForApplicationSchema,
    getAssignmentsByJobSchema,
    submitAssignmentSchema,
    updateAssignmentSchema,
} from '../validators/assignment.validator';
import {
    calcomWebhookSchema,
    interviewApplicationParamSchema,
    interviewIdParamSchema,
    listInterviewsSchema,
    saveInterviewNoteSchema,
    updateInterviewStatusSchema,
} from '../validators/interview.validator';
import { hiringReportSummarySchema } from '../validators/report.validator';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
        }
    },
});

// ============================================
// PUBLIC ROUTES — no auth required
// Used by the company website (creativeupaay.com)
// ============================================
router.get('/public/jobs', jobController.getActiveJobs);
router.post(
    '/public/apply/:jobId',
    upload.single('resume'),
    validateRequest(createPublicApplicationSchema),
    applicationController.createPublicApplication
);

router.get(
    '/assignment/:applicationId',
    validateRequest(getAssignmentForApplicationSchema),
    assignmentController.getAssignmentForApplication
);

router.post(
    '/assignment/submit/:applicationId',
    validateRequest(submitAssignmentSchema),
    assignmentController.submitAssignment
);

router.post(
    '/interview/calcom/webhook',
    validateRequest(calcomWebhookSchema),
    interviewController.handleCalcomWebhook
);

// ============================================
// PROTECTED ROUTES — require authentication
// ============================================
router.use(authenticate);

// Roles allowed to view jobs
const viewRoles = ['super-admin', 'admin', 'hr', 'hr-admin', 'hr-manager', 'manager'];
// Roles allowed to create/update/delete jobs
const manageRoles = ['super-admin', 'admin', 'hr', 'hr-admin', 'hr-manager'];

router.post(
    '/',
    authorize(manageRoles),
    validateRequest(createJobSchema),
    jobController.createJob
);

router.get(
    '/',
    authorize(viewRoles),
    validateRequest(listJobsSchema),
    jobController.getJobs
);

router.post(
    '/interview/invite/:applicationId',
    authorize(manageRoles),
    validateRequest(interviewApplicationParamSchema),
    interviewController.sendInterviewInvite
);

router.get(
    '/interviews',
    authorize(viewRoles),
    validateRequest(listInterviewsSchema),
    interviewController.getInterviews
);

router.get(
    '/reports/summary',
    authorize(viewRoles),
    validateRequest(hiringReportSummarySchema),
    reportController.getHiringReportSummary
);

router.patch(
    '/interviews/:id/status',
    authorize(manageRoles),
    validateRequest(interviewIdParamSchema),
    validateRequest(updateInterviewStatusSchema),
    interviewController.updateInterviewStatus
);

router.get(
    '/interviews/:id/details',
    authorize(viewRoles),
    validateRequest(interviewIdParamSchema),
    interviewController.getInterviewDetails
);

router.post(
    '/interviews/:id/notes',
    authorize(viewRoles),
    validateRequest(interviewIdParamSchema),
    validateRequest(saveInterviewNoteSchema),
    interviewController.saveInterviewNote
);

// ============================================
// JOB TEMPLATE ROUTES
// ============================================
router.post(
    '/templates',
    authorize(manageRoles),
    validateRequest(createJobTemplateSchema),
    jobTemplateController.createTemplate
);

router.get(
    '/templates',
    authorize(viewRoles),
    jobTemplateController.getTemplates
);

router.get(
    '/templates/:id',
    authorize(viewRoles),
    validateRequest(getJobTemplateSchema),
    jobTemplateController.getTemplate
);

router.patch(
    '/templates/:id',
    authorize(manageRoles),
    validateRequest(getJobTemplateSchema),
    validateRequest(updateJobTemplateSchema),
    jobTemplateController.updateTemplate
);

router.delete(
    '/templates/:id',
    authorize(manageRoles),
    validateRequest(getJobTemplateSchema),
    jobTemplateController.deleteTemplate
);

// ============================================
// APPLICATION ROUTES (ADMIN / HR)
// Must be declared BEFORE /:id to avoid Express
// matching "/applications" as a job ID.
// ============================================
router.get(
    '/applications',
    authorize(viewRoles),
    validateRequest(listApplicationsSchema),
    applicationController.getApplications
);

router.get(
    '/applications/:id',
    authorize(viewRoles),
    validateRequest(getApplicationSchema),
    applicationController.getApplication
);

router.get(
    '/applications/:id/timeline',
    authorize(viewRoles),
    validateRequest(getApplicationSchema),
    applicationController.getApplicationTimeline
);

router.patch(
    '/applications/:id/status',
    authorize(manageRoles),
    validateRequest(updateStatusSchema),
    applicationController.updateApplicationStatus
);

router.patch(
    '/applications/:id/decision',
    authorize(manageRoles),
    upload.single('offerLetter'),
    validateRequest(applicationDecisionSchema),
    applicationController.applyFinalDecision
);

router.post(
    '/applications/:id/tag',
    authorize(manageRoles),
    validateRequest(tagSchema),
    applicationController.addApplicationTag
);

router.delete(
    '/applications/:id/tag',
    authorize(manageRoles),
    validateRequest(tagSchema),
    applicationController.removeApplicationTag
);

router.patch(
    '/applications/:id',
    authorize(manageRoles),
    validateRequest(updateApplicationSchema),
    applicationController.updateApplication
);

router.post(
    '/assignments',
    authorize(manageRoles),
    validateRequest(createAssignmentSchema),
    assignmentController.createAssignment
);

router.get(
    '/assignments/job/:jobId',
    authorize(viewRoles),
    validateRequest(getAssignmentsByJobSchema),
    assignmentController.getAssignmentsByJob
);

router.patch(
    '/assignments/:id',
    authorize(manageRoles),
    validateRequest(updateAssignmentSchema),
    assignmentController.updateAssignment
);

router.delete(
    '/assignments/:id',
    authorize(manageRoles),
    validateRequest(assignmentIdParamSchema),
    assignmentController.deleteAssignment
);

router.get(
    '/assignments/:id/submissions',
    authorize(viewRoles),
    validateRequest(assignmentIdParamSchema),
    assignmentController.getAssignmentSubmissions
);

// ============================================
// JOB WILDCARD ROUTES — keep these AFTER /applications
// ============================================
router.get(
    '/:id',
    authorize(viewRoles),
    validateRequest(getJobSchema),
    jobController.getJob
);

router.patch(
    '/:id',
    authorize(manageRoles),
    validateRequest(getJobSchema),
    validateRequest(updateJobSchema),
    jobController.updateJob
);

router.patch(
    '/:id/toggle',
    authorize(manageRoles),
    validateRequest(getJobSchema),
    jobController.toggleJobHiring
);

router.delete(
    '/:id',
    authorize(manageRoles),
    validateRequest(getJobSchema),
    jobController.deleteJob
);

export default router;
