import { Router } from 'express';
import multer from 'multer';
import * as partnerPortalController from '../controllers/partnerPortal.controller';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { isPartner } from '../middlewares/isPartner.middleware';
import { extractPartnerContext } from '../middlewares/extractPartnerContext.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication and partner role
router.use(authenticate, isPartner, extractPartnerContext);

// Project routes
router.get('/projects', partnerPortalController.getProjects);
router.get('/projects/:projectId', partnerPortalController.getProject);

// Document routes - shared folder only
router.get('/projects/:projectId/documents', partnerPortalController.getDocuments);
router.post('/projects/:projectId/documents', upload.single('file'), partnerPortalController.uploadDocument);
router.get('/projects/:projectId/documents/:itemId/url', partnerPortalController.getDocumentUrl);

export default router;
