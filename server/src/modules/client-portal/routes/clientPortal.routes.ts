import { Router } from 'express';
import multer from 'multer';
import { clientPortalAuth } from '../middleware/clientPortalAuth';
import * as ctrl from '../controllers/clientPortal.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─── Public ───────────────────────────────────────────────────────────────────
// Exchange unique URL token → sets httpOnly portal_jwt cookie
router.post('/auth/exchange', ctrl.exchangeToken);
// Log out → clears portal_jwt cookie
router.post('/auth/logout', ctrl.logoutPortal);

// ─── Protected (client JWT) ───────────────────────────────────────────────────
router.use(clientPortalAuth);

router.get('/me', ctrl.getMe);

// Projects
router.get('/projects', ctrl.getProjects);
router.get('/projects/:projectId', ctrl.getProject);

// Tasks
router.get('/projects/:projectId/tasks', ctrl.getTasks);

// Meetings
router.get('/projects/:projectId/meetings', ctrl.getMeetings);

// Credentials
router.get('/projects/:projectId/credentials', ctrl.getCredentials);

// Documents (Shared Files folder)
router.get('/projects/:projectId/documents', ctrl.getDocuments);
router.post('/projects/:projectId/documents/upload', upload.single('file'), ctrl.uploadDocument);
router.get('/projects/:projectId/documents/:itemId/url', ctrl.getDocumentUrl);

// Comments — :entityType is 'tasks' or 'meetings'
router.get('/projects/:projectId/:entityType/:entityId/comments', ctrl.getComments);
router.post('/projects/:projectId/:entityType/:entityId/comments', ctrl.addComment);

export default router;
