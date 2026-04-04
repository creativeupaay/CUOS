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
import {
    authorizeHiringView,
    authorizeHiringManage,
    authorizeJobAccess,
} from '../middlewares/authorizeJobManager.middleware';
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
    requestInterviewRescheduleSchema,
    saveInterviewNoteSchema,
    updateInterviewStatusSchema,
    webhookDebugQuerySchema,
    webhookDebugPublicQuerySchema,
} from '../validators/interview.validator';
import { hiringReportSummarySchema } from '../validators/report.validator';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 12 },
    fileFilter: (_req, file, cb) => {
        const resumeAllowed = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        const attachmentAllowed = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
            'application/x-zip-compressed',
            'text/plain',
        ];
        if (
            resumeAllowed.includes(file.mimetype) ||
            attachmentAllowed.includes(file.mimetype) ||
            file.mimetype.startsWith('image/')
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only common document, spreadsheet, zip, text, and image files are allowed'));
        }
    },
});

const assignmentUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024,
        files: 8,
    },
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
            'application/x-zip-compressed',
            'text/plain',
        ];

        if (
            file.mimetype.startsWith('image/') ||
            file.mimetype.startsWith('video/') ||
            allowed.includes(file.mimetype)
        ) {
            cb(null, true);
            return;
        }

        cb(new Error('Only images, videos, PDF, office documents, zip files, and text files are allowed'));
    },
});

// ============================================
// PUBLIC ROUTES — no auth required
// Used by the company website (creativeupaay.com)
// ============================================
router.get('/public/jobs', jobController.getActiveJobs);
router.post(
    '/public/apply/:jobId',
    upload.any(),
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
    assignmentUpload.any(),
    validateRequest(submitAssignmentSchema),
    assignmentController.submitAssignment
);

router.post(
    '/interview/calcom/webhook',
    validateRequest(calcomWebhookSchema),
    interviewController.handleCalcomWebhook
);

router.get(
    '/interview/calcom/webhook-debug-public',
    validateRequest(webhookDebugPublicQuerySchema),
    interviewController.getWebhookDebugPublic
);

// ============================================
// PROTECTED ROUTES — require authentication
// ============================================
router.use(authenticate);

// Roles allowed to view jobs
const viewRoles = ['super-admin', 'admin', 'hr', 'hr-admin', 'hr-manager', 'manager'];
// Roles allowed to create/update/delete jobs
const manageRoles = ['super-admin', 'admin', 'hr', 'hr-admin', 'hr-manager'];

// ── Job Manager status check (must be before other hiring routes)
router.get(
    '/job-manager-status',
    jobController.checkJobManagerStatus
);

// ── Employees list for manager picker
router.get(
    '/employees-list',
    authorize(manageRoles),
    jobController.getEmployeesList
);

router.post(
    '/',
    authorizeHiringManage,
    validateRequest(createJobSchema),
    jobController.createJob
);

router.get(
    '/',
    authorizeHiringView,
    validateRequest(listJobsSchema),
    jobController.getJobs
);

router.post(
    '/interview/invite/:applicationId',
    authorizeHiringManage,
    validateRequest(interviewApplicationParamSchema),
    interviewController.sendInterviewInvite
);

router.get(
    '/interviews',
    authorizeHiringView,
    validateRequest(listInterviewsSchema),
    interviewController.getInterviews
);

router.get(
    '/interview/calcom/webhook-debug',
    authorizeHiringView,
    validateRequest(webhookDebugQuerySchema),
    interviewController.getWebhookDebug
);

router.get(
    '/reports/summary',
    authorizeHiringView,
    validateRequest(hiringReportSummarySchema),
    reportController.getHiringReportSummary
);

router.patch(
    '/interviews/:id/status',
    authorizeHiringManage,
    validateRequest(interviewIdParamSchema),
    validateRequest(updateInterviewStatusSchema),
    interviewController.updateInterviewStatus
);

router.post(
    '/interviews/:id/reschedule',
    authorizeHiringManage,
    validateRequest(interviewIdParamSchema),
    validateRequest(requestInterviewRescheduleSchema),
    interviewController.requestInterviewReschedule
);

router.get(
    '/interviews/:id/details',
    authorizeHiringView,
    validateRequest(interviewIdParamSchema),
    interviewController.getInterviewDetails
);

router.post(
    '/interviews/:id/notes',
    authorizeHiringView,
    validateRequest(interviewIdParamSchema),
    validateRequest(saveInterviewNoteSchema),
    interviewController.saveInterviewNote
);

// ============================================
// JOB TEMPLATE ROUTES
// ============================================
router.post(
    '/templates',
    authorizeHiringManage,
    validateRequest(createJobTemplateSchema),
    jobTemplateController.createTemplate
);

router.get(
    '/templates',
    authorizeHiringView,
    jobTemplateController.getTemplates
);

router.get(
    '/templates/:id',
    authorizeHiringView,
    validateRequest(getJobTemplateSchema),
    jobTemplateController.getTemplate
);

router.patch(
    '/templates/:id',
    authorizeHiringManage,
    validateRequest(getJobTemplateSchema),
    validateRequest(updateJobTemplateSchema),
    jobTemplateController.updateTemplate
);

router.delete(
    '/templates/:id',
    authorizeHiringManage,
    validateRequest(getJobTemplateSchema),
    jobTemplateController.deleteTemplate
);

router.get(
    '/application-fields',
    authorizeHiringView,
    jobController.getApplicationFieldLibrary
);

router.post(
    '/application-fields',
    authorizeHiringManage,
    jobController.saveApplicationField
);

router.delete(
    '/application-fields/:key',
    authorizeHiringManage,
    jobController.deleteApplicationField
);

// ============================================
// APPLICATION ROUTES (ADMIN / HR)
// Must be declared BEFORE /:id to avoid Express
// matching "/applications" as a job ID.
// ============================================
router.get(
    '/applications',
    authorizeHiringView,
    validateRequest(listApplicationsSchema),
    applicationController.getApplications
);

router.get(
    '/applications/:id',
    authorizeHiringView,
    validateRequest(getApplicationSchema),
    applicationController.getApplication
);

router.get(
    '/applications/:id/timeline',
    authorizeHiringView,
    validateRequest(getApplicationSchema),
    applicationController.getApplicationTimeline
);

router.patch(
    '/applications/:id/status',
    authorizeHiringManage,
    validateRequest(updateStatusSchema),
    applicationController.updateApplicationStatus
);

router.patch(
    '/applications/:id/decision',
    authorizeHiringManage,
    upload.single('offerLetter'),
    validateRequest(applicationDecisionSchema),
    applicationController.applyFinalDecision
);

router.post(
    '/applications/:id/tag',
    authorizeHiringManage,
    validateRequest(tagSchema),
    applicationController.addApplicationTag
);

router.delete(
    '/applications/:id/tag',
    authorizeHiringManage,
    validateRequest(tagSchema),
    applicationController.removeApplicationTag
);

router.patch(
    '/applications/:id',
    authorizeHiringManage,
    validateRequest(updateApplicationSchema),
    applicationController.updateApplication
);

router.post(
    '/assignments',
    authorizeHiringManage,
    validateRequest(createAssignmentSchema),
    assignmentController.createAssignment
);

router.get(
    '/assignments/job/:jobId',
    authorizeHiringView,
    validateRequest(getAssignmentsByJobSchema),
    assignmentController.getAssignmentsByJob
);

router.patch(
    '/assignments/:id',
    authorizeHiringManage,
    validateRequest(updateAssignmentSchema),
    assignmentController.updateAssignment
);

router.delete(
    '/assignments/:id',
    authorizeHiringManage,
    validateRequest(assignmentIdParamSchema),
    assignmentController.deleteAssignment
);

router.get(
    '/assignments/:id/submissions',
    authorizeHiringView,
    validateRequest(assignmentIdParamSchema),
    assignmentController.getAssignmentSubmissions
);

// ============================================
// JOB WILDCARD ROUTES — keep these AFTER /applications
// ============================================
router.get(
    '/:id',
    authorizeHiringView,
    validateRequest(getJobSchema),
    authorizeJobAccess,
    jobController.getJob
);

router.patch(
    '/:id',
    authorizeHiringManage,
    validateRequest(getJobSchema),
    authorizeJobAccess,
    validateRequest(updateJobSchema),
    jobController.updateJob
);

router.patch(
    '/:id/toggle',
    authorizeHiringManage,
    validateRequest(getJobSchema),
    authorizeJobAccess,
    jobController.toggleJobHiring
);

router.delete(
    '/:id',
    authorizeHiringManage,
    validateRequest(getJobSchema),
    authorizeJobAccess,
    jobController.deleteJob
);

export default router;
