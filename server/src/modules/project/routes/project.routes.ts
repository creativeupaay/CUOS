import { Router } from 'express';
import multer from 'multer';
import * as projectController from '../controllers/project.controller';
import * as taskController from '../controllers/task.controller';
import * as timeLogController from '../controllers/timeLog.controller';
import * as meetingController from '../controllers/meeting.controller';
import * as credentialController from '../controllers/credential.controller';
import { validateRequest } from '../../../middlewares/validateRequest';
import {
    checkProjectAccess,
    checkProjectManager,
    checkTaskAccess,
    checkCredentialAccess,
    checkMeetingAccess,
    checkAdmin,
} from '../middlewares/projectAccess.middleware';
import * as projectValidators from '../validators/project.validator';
import * as taskValidators from '../validators/task.validator';
import * as timeLogValidators from '../validators/timeLog.validator';
import * as meetingValidators from '../validators/meeting.validator';
import * as credentialValidators from '../validators/credential.validator';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// ============================================
// PROJECT ROUTES
// ============================================

// Create project
router.post(
    '/',
    validateRequest(projectValidators.createProjectSchema),
    projectController.createProject
);

// Get all projects (filtered by user access)
router.get('/', projectController.getProjects);

// Get project by ID
router.get(
    '/:id',
    validateRequest(projectValidators.getProjectByIdSchema),
    checkProjectAccess,
    projectController.getProjectById
);

// Update project
router.patch(
    '/:id',
    validateRequest(projectValidators.updateProjectSchema),
    checkProjectManager,
    projectController.updateProject
);

// Delete project (soft delete)
router.delete(
    '/:id',
    validateRequest(projectValidators.getProjectByIdSchema),
    checkAdmin,
    projectController.deleteProject
);

// Add assignee to project
router.post(
    '/:id/assignees',
    validateRequest(projectValidators.addAssigneeSchema),
    checkProjectManager,
    projectController.addAssignee
);

// Remove assignee from project
router.delete(
    '/:id/assignees/:userId',
    validateRequest(projectValidators.removeAssigneeSchema),
    checkProjectManager,
    projectController.removeAssignee
);

// Upload document
router.post(
    '/:id/documents',
    upload.single('file'),
    validateRequest(projectValidators.uploadDocumentSchema),
    checkProjectAccess,
    projectController.uploadDocument
);

// Get document (signed URL)
router.get(
    '/:id/documents/:docId',
    validateRequest(projectValidators.getDocumentSchema),
    checkProjectAccess,
    projectController.getDocument
);

// Delete document
router.delete(
    '/:id/documents/:docId',
    validateRequest(projectValidators.deleteDocumentSchema),
    checkProjectManager,
    projectController.deleteDocument
);

// ============================================
// TASK ROUTES
// ============================================

// Create task
router.post(
    '/:projectId/tasks',
    validateRequest(taskValidators.createTaskSchema),
    checkProjectAccess,
    taskController.createTask
);

// Get all tasks for a project
router.get(
    '/:projectId/tasks',
    validateRequest(taskValidators.getTasksSchema),
    checkProjectAccess,
    taskController.getTasks
);

// Get task by ID
router.get(
    '/:projectId/tasks/:taskId',
    validateRequest(taskValidators.getTaskByIdSchema),
    checkProjectAccess,
    taskController.getTaskById
);

// Update task
router.patch(
    '/:projectId/tasks/:taskId',
    validateRequest(taskValidators.updateTaskSchema),
    checkTaskAccess,
    taskController.updateTask
);

// Delete task
router.delete(
    '/:projectId/tasks/:taskId',
    validateRequest(taskValidators.deleteTaskSchema),
    checkProjectManager,
    taskController.deleteTask
);

// Create subtask
router.post(
    '/:projectId/tasks/:taskId/subtasks',
    validateRequest(taskValidators.createSubtaskSchema),
    checkProjectAccess,
    taskController.createSubtask
);

// Get subtasks
router.get(
    '/:projectId/tasks/:taskId/subtasks',
    validateRequest(taskValidators.getSubtasksSchema),
    checkProjectAccess,
    taskController.getSubtasks
);

// ============================================
// TIME LOG ROUTES
// ============================================

// Create time log
router.post(
    '/:projectId/tasks/:taskId/timelogs',
    validateRequest(timeLogValidators.createTimeLogSchema),
    checkTaskAccess,
    timeLogController.createTimeLog
);

// Get project time logs
router.get(
    '/:projectId/timelogs',
    validateRequest(timeLogValidators.getProjectTimeLogsSchema),
    checkProjectAccess,
    timeLogController.getProjectTimeLogs
);

// Get task time logs
router.get(
    '/:projectId/tasks/:taskId/timelogs',
    validateRequest(timeLogValidators.getTaskTimeLogsSchema),
    checkProjectAccess,
    timeLogController.getTaskTimeLogs
);

// ============================================
// MEETING ROUTES
// ============================================

// Create meeting
router.post(
    '/:projectId/meetings',
    validateRequest(meetingValidators.createMeetingSchema),
    checkProjectAccess,
    meetingController.createMeeting
);

// Get meetings
router.get(
    '/:projectId/meetings',
    validateRequest(meetingValidators.getMeetingsSchema),
    checkProjectAccess,
    meetingController.getMeetings
);

// Get meeting by ID
router.get(
    '/:projectId/meetings/:id',
    validateRequest(meetingValidators.getMeetingByIdSchema),
    checkMeetingAccess,
    meetingController.getMeetingById
);

// Update meeting
router.patch(
    '/:projectId/meetings/:id',
    validateRequest(meetingValidators.updateMeetingSchema),
    checkMeetingAccess,
    meetingController.updateMeeting
);

// Delete meeting
router.delete(
    '/:projectId/meetings/:id',
    validateRequest(meetingValidators.deleteMeetingSchema),
    checkProjectManager,
    meetingController.deleteMeeting
);

// ============================================
// CREDENTIAL ROUTES
// ============================================

// Create credential
router.post(
    '/:projectId/credentials',
    validateRequest(credentialValidators.createCredentialSchema),
    checkProjectManager,
    credentialController.createCredential
);

// Get credentials
router.get(
    '/:projectId/credentials',
    validateRequest(credentialValidators.getCredentialsSchema),
    checkProjectAccess,
    credentialController.getCredentials
);

// Get credential by ID (decrypted)
router.get(
    '/:projectId/credentials/:id',
    validateRequest(credentialValidators.getCredentialByIdSchema),
    checkCredentialAccess,
    credentialController.getCredentialById
);

// Update credential
router.patch(
    '/:projectId/credentials/:id',
    validateRequest(credentialValidators.updateCredentialSchema),
    checkCredentialAccess,
    credentialController.updateCredential
);

// Delete credential
router.delete(
    '/:projectId/credentials/:id',
    validateRequest(credentialValidators.deleteCredentialSchema),
    checkProjectManager,
    credentialController.deleteCredential
);

// ============================================
// GLOBAL TIME LOG ROUTES (not project-specific)
// ============================================

// Get my time logs
router.get(
    '/timelogs/my',
    validateRequest(timeLogValidators.getMyTimeLogsSchema),
    timeLogController.getMyTimeLogs
);

// Update time log
router.patch(
    '/timelogs/:id',
    validateRequest(timeLogValidators.updateTimeLogSchema),
    timeLogController.updateTimeLog
);

// Delete time log
router.delete(
    '/timelogs/:id',
    validateRequest(timeLogValidators.deleteTimeLogSchema),
    timeLogController.deleteTimeLog
);

export default router;
